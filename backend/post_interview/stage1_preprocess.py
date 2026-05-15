"""Stage 1 — FFmpeg preprocessing.

Demux audio → WAV 16 kHz mono, re-encode video at 25 FPS,
create 480p 15 FPS proxy, and build frame-index-to-timestamp mapping.
Gracefully degrades when FFmpeg is not installed.

NOTE: Uses subprocess.run (sync) via run_in_executor instead of
asyncio.create_subprocess_exec for Windows compatibility.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from post_interview.schema import MASTER_VIDEO_FPS, PROXY_FPS, PROXY_MAX_HEIGHT

log = logging.getLogger(__name__)


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _run_sync(cmd: list[str]) -> tuple[int, str, str]:
    """Run a command synchronously, return (returncode, stdout, stderr)."""
    try:
        r = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=300,
        )
        return r.returncode, r.stdout.decode(errors="replace"), r.stderr.decode(errors="replace")
    except FileNotFoundError:
        return -1, "", "command not found"
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


async def _run(cmd: list[str]) -> tuple[int, str, str]:
    """Run command in a thread pool for async compatibility on Windows."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run_sync, cmd)


def _ffprobe_duration_sync(path: Path) -> float:
    if not shutil.which("ffprobe"):
        return 0.0
    code, out, _ = _run_sync([
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ])
    if code != 0:
        return 0.0
    try:
        return max(0.0, float(out.strip()))
    except ValueError:
        return 0.0


async def _ffprobe_duration(path: Path) -> float:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _ffprobe_duration_sync, path)


def _build_frame_index_map(duration_sec: float) -> dict[str, Any]:
    """Maps proxy frame indices and master frame indices to wall-clock seconds."""
    n_proxy = max(0, int(duration_sec * PROXY_FPS) + 1)
    n_master = max(0, int(duration_sec * MASTER_VIDEO_FPS) + 1)
    return {
        "duration_sec": round(duration_sec, 6),
        "master_video_fps": MASTER_VIDEO_FPS,
        "proxy_fps": PROXY_FPS,
        "proxy_frame_count": n_proxy,
        "master_frame_count": n_master,
    }


async def run_stage1_preprocess(
    *,
    session_workdir: Path,
    source_video: Path | None,
    existing_audio: Path | None,
) -> dict[str, Any]:
    """
    Produce:
      - demux_audio.wav  (16 kHz mono PCM)
      - video_master_25fps.mp4  (video-only, 25 FPS)
      - video_proxy_480p_15fps.mp4
      - frame_index_map.json

    Returns a manifest dict describing what was produced.
    """
    out_dir = session_workdir / "post_interview"
    out_dir.mkdir(parents=True, exist_ok=True)

    audio_out = out_dir / "demux_audio.wav"
    video_master = out_dir / "video_master_25fps.mp4"
    video_proxy = out_dir / "video_proxy_480p_15fps.mp4"
    frame_map_path = out_dir / "frame_index_map.json"

    manifest: dict[str, Any] = {
        "stage": 1,
        "audio_wav": None,
        "video_master_25fps": None,
        "video_proxy_480p_15fps": None,
        "frame_index_map": None,
        "duration_sec": 0.0,
        "errors": [],
    }

    has_ffmpeg = _ffmpeg_available()
    if not has_ffmpeg:
        manifest["errors"].append("FFmpeg not found — skipping video/audio preprocessing")
        log.warning("FFmpeg not installed; Stage 1 will use raw files only")

    duration_sec = 0.0
    has_video = (
        source_video is not None
        and source_video.exists()
        and source_video.stat().st_size > 0
    )

    # ── Process video (if available and FFmpeg present) ──
    if has_video and has_ffmpeg:
        # 1) Master video @ 25 FPS (no audio)
        code, _, err = await _run([
            "ffmpeg", "-y", "-i", str(source_video),
            "-an", "-r", str(MASTER_VIDEO_FPS),
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            str(video_master),
        ])
        if code != 0:
            manifest["errors"].append(f"ffmpeg master video: {err[:600]}")
        elif video_master.exists():
            manifest["video_master_25fps"] = str(video_master.resolve())
            duration_sec = max(duration_sec, await _ffprobe_duration(video_master))

        # 2) Proxy 480p @ 15 FPS
        if video_master.exists():
            code, _, err = await _run([
                "ffmpeg", "-y", "-i", str(video_master),
                "-an", "-vf", f"scale=-2:{PROXY_MAX_HEIGHT},fps={PROXY_FPS}",
                "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
                str(video_proxy),
            ])
            if code != 0:
                manifest["errors"].append(f"ffmpeg proxy: {err[:600]}")
            elif video_proxy.exists():
                manifest["video_proxy_480p_15fps"] = str(video_proxy.resolve())

        # 3) Demux audio from video container (best quality source)
        code, _, err = await _run([
            "ffmpeg", "-y", "-i", str(source_video),
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            str(audio_out),
        ])
        if code != 0:
            manifest["errors"].append(f"ffmpeg demux audio: {err[:600]}")
        elif audio_out.exists() and audio_out.stat().st_size > 0:
            manifest["audio_wav"] = str(audio_out.resolve())
            duration_sec = max(duration_sec, await _ffprobe_duration(audio_out))

    # ── Fallback: standalone audio file ──
    if not manifest["audio_wav"] and existing_audio and existing_audio.exists():
        if has_ffmpeg:
            code, _, err = await _run([
                "ffmpeg", "-y", "-i", str(existing_audio),
                "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                str(audio_out),
            ])
            if code == 0 and audio_out.exists() and audio_out.stat().st_size > 0:
                manifest["audio_wav"] = str(audio_out.resolve())
                duration_sec = max(duration_sec, await _ffprobe_duration(audio_out))
            else:
                manifest["errors"].append(f"ffmpeg audio fallback: {err[:600]}")
        else:
            # No FFmpeg — just reference the raw audio file
            manifest["audio_wav"] = str(existing_audio.resolve())

    # ── Duration fallback ──
    if duration_sec <= 0 and manifest["audio_wav"]:
        duration_sec = await _ffprobe_duration(Path(manifest["audio_wav"]))

    manifest["duration_sec"] = duration_sec

    # ── Frame index map ──
    frame_map = _build_frame_index_map(duration_sec)
    frame_map_path.write_text(json.dumps(frame_map, indent=2), encoding="utf-8")
    manifest["frame_index_map"] = str(frame_map_path.resolve())

    log.info("Stage 1 complete: audio=%s, video=%s, duration=%.1fs",
             manifest["audio_wav"] is not None,
             manifest["video_master_25fps"] is not None,
             duration_sec)
    return manifest
