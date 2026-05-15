"""Stage 2 — Speech & Voice Analysis (parallel).

Two jobs on audio.wav:
  A) Whisper transcription with word-level timestamps + filler extraction
  B) Parselmouth voice quality per 250 ms frame

Both gracefully degrade when the dependency is not installed.
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Any

from post_interview.schema import FILLER_LEXICON, PARSELMOUTH_FRAME_MS

log = logging.getLogger(__name__)


# ────────────────────────────────────────────────────────────
#  Whisper transcription
# ────────────────────────────────────────────────────────────

def _whisper_language_code(session_language: str) -> tuple[str | None, str]:
    """Returns (faster_whisper language code or None for auto, hint label)."""
    sl = (session_language or "").lower()
    if "hindi" in sl and "hing" not in sl:
        return "hi", "hi"
    if "hinglish" in sl or sl in ("hi-en", "mixed"):
        return None, "auto"
    return "en", "en"


def _normalize_token(word: str) -> str:
    """Strip leading/trailing punctuation so Whisper tokens like 'Um,' match 'um'."""
    return re.sub(r"^[^\w]+|[^\w]+$", "", (word or "").lower())


def _count_fillers(words: list[dict[str, Any]]) -> dict[str, int]:
    """Word-level filler matches using the curated lexicon."""
    tokens = [_normalize_token(str(w.get("word", ""))) for w in words if str(w.get("word", "")).strip()]
    text = " ".join(tokens)
    counts: dict[str, int] = {}
    for phrase in FILLER_LEXICON:
        if " " in phrase:
            n = len(re.findall(re.escape(phrase), text, re.IGNORECASE))
        else:
            n = len(re.findall(rf"\b{re.escape(phrase)}\b", text, re.IGNORECASE))
        if n:
            counts[phrase] = n
    return counts


async def _run_whisper(audio_wav: Path | None, session_language: str) -> dict[str, Any]:
    """
    Transcribe with faster-whisper (medium model, word timestamps).
    Falls back gracefully if not installed.
    """
    out: dict[str, Any] = {
        "tool": "faster_whisper",
        "model": None,
        "language_hint": None,
        "segments": [],
        "words": [],
        "text": "",
        "fillers": {},
        "error": None,
    }

    if not audio_wav or not audio_wav.exists() or audio_wav.stat().st_size == 0:
        out["error"] = "no_audio_wav"
        return out

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError:
        out["error"] = "faster-whisper not installed — will use live transcript instead"
        return out

    lang_code, hint = _whisper_language_code(session_language)
    out["language_hint"] = hint
    model_name = "medium"
    out["model"] = model_name

    def _transcribe() -> dict[str, Any]:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
        segments_iter, info = model.transcribe(
            str(audio_wav),
            word_timestamps=True,
            language=lang_code,
            vad_filter=True,
        )
        segments: list[dict[str, Any]] = []
        words_flat: list[dict[str, Any]] = []
        texts: list[str] = []
        for seg in segments_iter:
            txt = seg.text.strip()
            texts.append(txt)
            wd: list[dict[str, Any]] = []
            if seg.words:
                for w in seg.words:
                    entry = {"word": w.word.strip(), "start": float(w.start), "end": float(w.end)}
                    wd.append(entry)
                    words_flat.append(entry)
            segments.append({
                "start": float(seg.start),
                "end": float(seg.end),
                "text": txt,
                "words": wd,
            })
        return {
            "detected_language": getattr(info, "language", None),
            "segments": segments,
            "words": words_flat,
            "text": " ".join(texts).strip(),
        }

    loop = asyncio.get_event_loop()
    try:
        raw = await loop.run_in_executor(None, _transcribe)
    except Exception as e:
        log.exception("Whisper transcription failed")
        out["error"] = str(e)
        return out

    out["segments"] = raw["segments"]
    out["words"] = raw["words"]
    out["text"] = raw["text"]
    out["detected_language"] = raw.get("detected_language")
    out["fillers"] = _count_fillers(raw["words"])
    return out


# ────────────────────────────────────────────────────────────
#  Parselmouth voice quality
# ────────────────────────────────────────────────────────────

def _parselmouth_sync(audio_wav: Path) -> dict[str, Any]:
    """Per-250ms-frame pitch, intensity, jitter, shimmer, HNR."""
    try:
        import parselmouth
        from parselmouth.praat import call
    except ImportError:
        return {"tool": "parselmouth", "frames": [], "error": "parselmouth not installed"}

    try:
        snd = parselmouth.Sound(str(audio_wav))
        duration = snd.get_total_duration()
    except Exception as e:
        return {"tool": "parselmouth", "frames": [], "error": str(e)}

    frame_sec = PARSELMOUTH_FRAME_MS / 1000.0
    frames: list[dict[str, Any]] = []
    t = 0.0

    while t + frame_sec <= duration + 1e-6:
        t1 = min(t + frame_sec, duration)
        try:
            part = snd.extract_part(from_time=t, to_time=t1, preserve_times=True)

            # Pitch (F0)
            pitch = part.to_pitch(time_step=frame_sec / 4, pitch_floor=75, pitch_ceiling=500)
            pitch_values = pitch.selected_array["frequency"]
            valid = pitch_values[pitch_values > 0]
            f0_mean = float(valid.mean()) if len(valid) else 0.0
            f0_var = float(valid.var()) if len(valid) > 1 else 0.0

            # Intensity
            intensity = part.to_intensity(minimum_pitch=75, time_step=frame_sec / 4)
            iv = intensity.values[intensity.values > 0]
            int_mean = float(iv.mean()) if len(iv) else 0.0

            # Jitter & shimmer
            pp = call(part, "To PointProcess (periodic, cc)", 75, 500)
            jitter = call(pp, "Get jitter (local)", 0.0001, 0.02, 1.3)
            shimmer = call([part, pp], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

            # HNR
            harm = call(part, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            hnr = call(harm, "Get mean", 0, 0)

            # Sanitize (Praat can return "--undefined--" strings)
            jitter = 0.0 if isinstance(jitter, str) else float(jitter)
            shimmer = 0.0 if isinstance(shimmer, str) else float(shimmer)
            hnr = 0.0 if isinstance(hnr, str) else float(hnr)
        except Exception:
            f0_mean = f0_var = int_mean = jitter = shimmer = hnr = 0.0

        frames.append({
            "t_start_sec": round(t, 4),
            "t_end_sec": round(t1, 4),
            "f0_mean_hz": round(f0_mean, 2),
            "f0_variance_hz2": round(f0_var, 4),
            "intensity_mean_db": round(int_mean, 3),
            "jitter_local_pct": round(jitter * 100, 4),
            "shimmer_local_pct": round(shimmer * 100, 4),
            "hnr_db": round(hnr, 3),
        })
        t += frame_sec

    return {"tool": "parselmouth", "frame_ms": PARSELMOUTH_FRAME_MS, "frames": frames, "error": None}


async def _run_parselmouth(audio_wav: Path | None) -> dict[str, Any]:
    if not audio_wav or not audio_wav.exists():
        return {"tool": "parselmouth", "frames": [], "error": "no_audio_wav"}
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _parselmouth_sync, audio_wav)


# ────────────────────────────────────────────────────────────
#  Parallel runner
# ────────────────────────────────────────────────────────────

async def run_stage2_parallel(
    audio_wav: Path | None,
    session_language: str,
) -> dict[str, Any]:
    """Run Whisper + Parselmouth in parallel; return combined stage-2 result."""
    whisper_out, parsel_out = await asyncio.gather(
        _run_whisper(audio_wav, session_language),
        _run_parselmouth(audio_wav),
    )
    return {
        "stage": 2,
        "whisper": whisper_out,
        "parselmouth": parsel_out,
    }
