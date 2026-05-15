"""Post-interview scorecard entry point.

Called from server.py's /finalize endpoint as a background task.
Delegates to the post_interview.pipeline for the full 4-stage analysis.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from post_interview.pipeline import run_post_interview_pipeline
from services import session_manager as sm

log = logging.getLogger(__name__)


async def run_post_interview_analysis(session_id: str) -> dict[str, Any]:
    """Run the full post-interview pipeline and return scorecard JSON."""
    return await run_post_interview_pipeline(session_id)


async def analyze_session_task(session_id: str) -> None:
    """Background task: analyze → set scorecard or mark failed."""
    sm.set_status(session_id, sm.SessionStatus.ANALYZING)
    try:
        result = await run_post_interview_analysis(session_id)
        if result.get("error"):
            sm.set_status(session_id, sm.SessionStatus.FAILED, result["error"])
            return
        sm.set_scorecard(session_id, result)
        log.info("Scorecard ready for session %s (score=%s)",
                 session_id, result.get("overall_score"))
    except Exception as e:
        log.exception("Post-interview pipeline failed for session %s", session_id)
        sm.set_status(session_id, sm.SessionStatus.FAILED, repr(e))


def schedule_analysis(session_id: str) -> None:
    """Fire-and-forget analysis (use when not inside a background task)."""
    asyncio.create_task(analyze_session_task(session_id))
