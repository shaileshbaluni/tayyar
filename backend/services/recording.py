"""Persist per-session audio, video, and transcript artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from config import get_settings


def session_dir(session_id: str) -> Path:
    base = Path(get_settings().storage_dir) / "sessions" / session_id
    base.mkdir(parents=True, exist_ok=True)
    return base


def write_bytes(session_id: str, name: str, data: bytes) -> str:
    d = session_dir(session_id)
    path = d / name
    path.write_bytes(data)
    return str(path.resolve())


def write_transcript_json(session_id: str, transcript: list[dict[str, Any]]) -> str:
    d = session_dir(session_id)
    path = d / "transcript.json"
    path.write_text(json.dumps(transcript, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(path.resolve())


def write_metrics_log(session_id: str, batches: list[dict[str, Any]]) -> str:
    d = session_dir(session_id)
    path = d / "mediapipe_metrics.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for b in batches:
            f.write(json.dumps(b, ensure_ascii=False) + "\n")
    return str(path.resolve())
