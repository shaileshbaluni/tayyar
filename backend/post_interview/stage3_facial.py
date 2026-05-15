"""Stage 3 — Facial Analysis (parallel).

Two jobs on the video proxy:
  A) OpenFace 3.0 — 17 AUs, head pose, gaze vectors (CLI integration)
  B) Py-Feat — 7-class emotion probabilities per frame

Both gracefully degrade when not configured/installed.

NOTE: Uses subprocess.run via run_in_executor for Windows compatibility.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)


def _run_cmd_sync(cmd: list[str], cwd: Path | None = None) -> tuple[int, str]:
    try:
        r = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(cwd) if cwd else None,
            timeout=300,
        )
        return r.returncode, (r.stdout + r.stderr).decode(errors="replace")
    except Exception as e:
        return -1, str(e)


async def _run_cmd(cmd: list[str], cwd: Path | None = None) -> tuple[int, str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_cmd_sync, cmd, cwd)


def _ffprobe_duration_sync(path: Path) -> float:
    if not shutil.which("ffprobe"):
        return 30.0
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error",
             "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1",
             str(path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if r.returncode != 0:
            return 30.0
        return max(1.0, float(r.stdout.decode().strip()))
    except Exception:
        return 30.0


async def _ffprobe_duration(path: Path) -> float:
    """Quick duration probe for generating neutral series."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ffprobe_duration_sync, path)


def _neutral_emotion(t: float) -> dict[str, Any]:
    """Default neutral emotion probability vector at time t."""
    return {
        "t_sec": round(t, 3),
        "probabilities": {
            "anger": 0.04, "contempt": 0.04, "disgust": 0.04, "fear": 0.04,
            "happiness": 0.10, "sadness": 0.04, "surprise": 0.04, "neutral": 0.66,
        },
    }


# ────────────────────────────────────────────────────────────
#  OpenFace 3.0
# ────────────────────────────────────────────────────────────

async def _run_openface(proxy_video: Path | None, workdir: Path) -> dict[str, Any]:
    """
    Run OpenFace 3.0 CLI if OPENFACE3_EXECUTABLE is set.
    Expects the wrapper to emit openface_features.json in the output dir.
    Falls back gracefully if not configured.
    """
    base: dict[str, Any] = {
        "tool": "openface3",
        "source": "not_configured",
        "frames": [],
        "summary": {},
        "error": None,
    }

    if not proxy_video or not proxy_video.exists():
        base["error"] = "no_proxy_video"
        return base

    exe = os.environ.get("OPENFACE3_EXECUTABLE", "").strip()
    if not exe:
        base["error"] = "OPENFACE3_EXECUTABLE not set — body language from MediaPipe + voice only"
        return base

    out_dir = workdir / "openface_out"
    out_dir.mkdir(parents=True, exist_ok=True)

    code, msg = await _run_cmd([exe, "-i", str(proxy_video), "-out_dir", str(out_dir)])
    if code != 0:
        base["error"] = f"openface exit {code}: {msg[:1000]}"
        return base

    # Look for structured JSON output
    preferred = out_dir / "openface_features.json"
    if preferred.exists():
        try:
            data = json.loads(preferred.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {"tool": "openface3", "source": "cli", **data, "error": None}
        except Exception as e:
            base["error"] = f"parse openface_features.json: {e}"
            return base

    # Try any JSON in the output dir
    for p in sorted(out_dir.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, dict) and "frames" in data:
                return {"tool": "openface3", "source": "cli", **data, "error": None}
        except Exception:
            continue

    base["error"] = "openface produced no parseable JSON output"
    return base


# ────────────────────────────────────────────────────────────
#  Py-Feat
# ────────────────────────────────────────────────────────────

async def _run_pyfeat(proxy_video: Path | None) -> dict[str, Any]:
    """
    Py-Feat 7-class emotion per sampled frame.
    Requires PYFEAT_ENABLED=1 and py-feat installed.
    Falls back to a neutral emotion time series.
    """
    out: dict[str, Any] = {"tool": "pyfeat", "source": "neutral_prior", "frames": [], "error": None}

    if not proxy_video or not proxy_video.exists():
        out["error"] = "no_proxy_video"
        return out

    duration = await _ffprobe_duration(proxy_video)

    if os.environ.get("PYFEAT_ENABLED", "").lower() not in ("1", "true", "yes"):
        out["error"] = "PYFEAT_ENABLED not set — using neutral emotion prior"
        for t in [i * 0.5 for i in range(int(duration * 2) + 1)]:
            out["frames"].append(_neutral_emotion(t))
        return out

    def _detect() -> list[dict[str, Any]]:
        try:
            import cv2  # type: ignore
            from feat import Detector  # type: ignore
        except ImportError as e:
            raise RuntimeError(str(e)) from e

        det = Detector()
        cap = cv2.VideoCapture(str(proxy_video))
        fps = cap.get(cv2.CAP_PROP_FPS) or 15.0
        rows: list[dict[str, Any]] = []
        idx = 0
        step = max(1, int(fps / 2))

        while True:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok:
                break
            try:
                fer = det.detect_image(frame)
                if fer is not None and hasattr(fer, "emotions") and len(fer.emotions):
                    emo = fer.emotions
                    row = emo.iloc[0].to_dict() if hasattr(emo, "iloc") else {}
                    rows.append({
                        "t_sec": round(idx / fps, 4),
                        "probabilities": {k: float(v) for k, v in row.items()},
                    })
            except Exception:
                rows.append(_neutral_emotion(idx / fps))
            idx += step
        cap.release()
        return rows or [_neutral_emotion(0.0)]

    loop = asyncio.get_event_loop()
    try:
        frames = await loop.run_in_executor(None, _detect)
        out["frames"] = frames
        out["source"] = "pyfeat"
    except Exception as e:
        out["error"] = str(e)
        for t in [i * 0.5 for i in range(int(duration * 2) + 1)]:
            out["frames"].append(_neutral_emotion(t))

    return out


# ────────────────────────────────────────────────────────────
#  Parallel runner
# ────────────────────────────────────────────────────────────

async def run_stage3_parallel(proxy_video: Path | None, workdir: Path) -> dict[str, Any]:
    """Run OpenFace + Py-Feat in parallel; return combined stage-3 result."""
    openface_out, pyfeat_out = await asyncio.gather(
        _run_openface(proxy_video, workdir),
        _run_pyfeat(proxy_video),
    )
    return {"stage": 3, "openface": openface_out, "pyfeat": pyfeat_out}
