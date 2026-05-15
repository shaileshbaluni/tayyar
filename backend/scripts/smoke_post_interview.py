"""Smoke test: minimal session + run post-interview pipeline. Run from repo: python scripts/smoke_post_interview.py"""

from __future__ import annotations

import os

# Fast local smoke test (avoid multi-minute medium model download / inference)
os.environ.setdefault("WHISPER_POST_MODEL", "tiny")

import asyncio
import struct
import sys
import wave
from pathlib import Path

# Ensure backend is on path when run as `python scripts/smoke_post_interview.py` from backend/
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


async def _run() -> dict:
    from post_interview.pipeline import run_post_interview_pipeline
    from services import recording as rec
    from services import session_manager as sm

    sid = sm.new_session_id()
    sess = sm.InterviewSession(
        id=sid,
        company="TCS",
        role="SDE",
        round_code="R2",
        language="English",
        voice_id=None,
        persona_id="tech-deep-dive",
        system_prompt="test",
    )
    sm.create_session(sess)

    d = rec.session_dir(sid)
    wav_path = d / "candidate_silence.wav"
    # 3 s silence, 16 kHz mono 16-bit PCM (valid for FFmpeg / Whisper)
    with wave.open(str(wav_path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        for _ in range(16000 * 3):
            w.writeframes(struct.pack("<h", 0))

    sm.set_recordings(sid, {"audio": str(wav_path.resolve())})
    sm.append_transcript_event(sid, {"role": "interviewer", "text": "How are you doing today?"})
    sm.append_transcript_event(sid, {"role": "candidate", "text": "I am doing well thank you."})
    sm.append_transcript_event(sid, {"role": "interviewer", "text": "Tell me about a project."})
    sm.append_transcript_event(sid, {"role": "candidate", "text": "I built a REST API with caching."})

    return await run_post_interview_pipeline(sid)


def main() -> None:
    out = asyncio.run(_run())
    err = out.get("error")
    if err:
        print("FAIL:", err)
        sys.exit(1)
    overall = out.get("overall_score")
    params = out.get("parameter_scores") or {}
    print("OK pipeline completed.")
    print("  overall_score:", overall)
    print("  parameters:", ", ".join(sorted(params.keys())))
    qb = out.get("question_breakdown") or []
    print("  question_breakdown count:", len(qb))
    td = out.get("trend_data") or {}
    print("  whisper_error:", td.get("whisper_error"))
    print("  parselmouth_error:", td.get("parselmouth_error"))
    if overall is None:
        print("FAIL: missing overall_score")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
