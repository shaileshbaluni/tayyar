"""In-memory session registry (swap for Redis in production)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class SessionStatus(str, Enum):
    LIVE = "live"
    FINALIZING = "finalizing"
    ANALYZING = "analyzing"
    READY = "ready"
    FAILED = "failed"


@dataclass
class InterviewSession:
    id: str
    company: str
    role: str
    round_code: str
    language: str
    voice_id: str | None
    persona_id: str
    system_prompt: str
    live_voice_name: str | None = None
    interviewer_gender: str | None = None
    daily_room_url: str | None = None
    daily_token: str | None = None
    status: SessionStatus = SessionStatus.LIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    transcript: list[dict[str, Any]] = field(default_factory=list)
    metrics_batches: list[dict[str, Any]] = field(default_factory=list)
    recording_paths: dict[str, str | None] = field(default_factory=dict)
    analysis_error: str | None = None
    scorecard: dict[str, Any] | None = None
    context_applied: bool = False
    briefing_chars: int = 0
    has_resume_text: bool = False


_sessions: dict[str, InterviewSession] = {}


def new_session_id() -> str:
    return str(uuid.uuid4())


def create_session(session: InterviewSession) -> InterviewSession:
    _sessions[session.id] = session
    return session


def get_session(session_id: str) -> InterviewSession | None:
    return _sessions.get(session_id)


def append_transcript_event(session_id: str, event: dict[str, Any]) -> None:
    s = _sessions.get(session_id)
    if not s:
        return
    s.transcript.append(event)


def append_metrics_batch(session_id: str, batch: dict[str, Any]) -> None:
    s = _sessions.get(session_id)
    if not s:
        return
    s.metrics_batches.append(batch)


def set_recordings(session_id: str, paths: dict[str, str | None]) -> None:
    s = _sessions.get(session_id)
    if not s:
        return
    s.recording_paths.update({k: v for k, v in paths.items() if v})


def set_status(session_id: str, status: SessionStatus, error: str | None = None) -> None:
    s = _sessions.get(session_id)
    if not s:
        return
    s.status = status
    s.analysis_error = error


def set_scorecard(session_id: str, payload: dict[str, Any]) -> None:
    s = _sessions.get(session_id)
    if not s:
        return
    s.scorecard = payload
    s.status = SessionStatus.READY
