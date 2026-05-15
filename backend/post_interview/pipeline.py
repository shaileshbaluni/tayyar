"""Pipeline orchestrator — runs stages 1-4 and returns the scorecard JSON.

Stages 2 (speech) and 3 (facial) run in parallel after stage 1.
Stage 4 merges everything and produces the final scorecard.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from post_interview.stage1_preprocess import run_stage1_preprocess
from post_interview.stage2_speech import run_stage2_parallel
from post_interview.stage3_facial import run_stage3_parallel
from post_interview.stage4_merger import merge_and_build_scorecard
from services import recording as rec
from services import session_manager as sm

log = logging.getLogger(__name__)


async def run_post_interview_pipeline(session_id: str) -> dict[str, Any]:
    """Full post-interview pipeline: preprocess → parallel analysis → merge → scorecard."""

    sess = sm.get_session(session_id)
    if not sess:
        return {"error": "session not found"}

    paths = sess.recording_paths
    video_raw = paths.get("video")
    audio_raw = paths.get("audio")
    transcript_path = paths.get("transcript")

    session_root = rec.session_dir(session_id)
    video_path = Path(video_raw) if video_raw else None
    audio_path = Path(audio_raw) if audio_raw else None

    log.info("Starting post-interview pipeline for session %s", session_id)

    # ── Stage 1: FFmpeg preprocessing ──
    stage1 = await run_stage1_preprocess(
        session_workdir=session_root,
        source_video=video_path if video_path and video_path.exists() else None,
        existing_audio=audio_path if audio_path and audio_path.exists() else None,
    )

    # ── Stages 2 & 3: parallel ──
    audio_wav = stage1.get("audio_wav")
    audio_wav_path = Path(audio_wav) if audio_wav else None

    proxy = stage1.get("video_proxy_480p_15fps")
    proxy_path = Path(proxy) if proxy else None
    workdir = session_root / "post_interview"

    stage2, stage3 = await asyncio.gather(
        run_stage2_parallel(audio_wav_path, sess.language or "English"),
        run_stage3_parallel(proxy_path, workdir),
    )

    # ── Transcript ──
    transcript_events: list[dict[str, Any]] = list(sess.transcript)
    if transcript_path and Path(transcript_path).exists():
        try:
            transcript_events = json.loads(Path(transcript_path).read_text(encoding="utf-8"))
        except Exception:
            log.warning("Could not parse transcript file, using live transcript")

    # ── Persist pipeline bundle (debug) ──
    try:
        bundle = {
            "session_id": session_id,
            "stage1": stage1,
            "stage2": stage2,
            "stage3": stage3,
        }
        raw_json = json.dumps(bundle, indent=2, default=str)
        (workdir / "pipeline_bundle.json").write_text(raw_json[:800000], encoding="utf-8")
    except Exception:
        log.warning("Could not persist pipeline_bundle.json")

    # ── Stage 4: merge and build scorecard ──
    scorecard = await merge_and_build_scorecard(
        session_id=session_id,
        company=sess.company,
        role=sess.role,
        transcript_events=transcript_events,
        mediapipe_batches=sess.metrics_batches,
        stage1=stage1,
        stage2=stage2,
        stage3=stage3,
    )

    log.info("Pipeline complete for session %s — overall score: %s",
             session_id, scorecard.get("overall_score"))
    return scorecard
