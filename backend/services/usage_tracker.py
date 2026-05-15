"""
Tracks Gemini API usage: model, purpose, tokens, cost estimates, and session context.
Stores usage logs in-memory with persistence to a JSON file.
"""

from __future__ import annotations

import json
import logging
import time
import traceback
from pathlib import Path
from threading import Lock
from typing import Any

log = logging.getLogger(__name__)

_USAGE_FILE = Path(__file__).parent.parent / "storage" / "usage_log.json"
_lock = Lock()
_log_entries: list[dict[str, Any]] = []
_loaded = False


def _ensure_loaded():
    global _loaded, _log_entries
    if _loaded:
        return
    with _lock:
        if _loaded:
            return
        _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        if _USAGE_FILE.exists():
            try:
                _log_entries = json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
            except Exception:
                _log_entries = []
        _loaded = True


def _persist():
    try:
        _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _USAGE_FILE.write_text(json.dumps(_log_entries, indent=2), encoding="utf-8")
    except Exception as e:
        log.warning("Failed to persist usage log: %s", e)


# ── Model tier & pricing (per 1M tokens, USD) ──
MODEL_INFO = {
    "gemini-3.1-flash-live-preview": {
        "tier": "Premium",
        "family": "Gemini 3.1",
        "input_per_1m": 0.75,
        "output_per_1m": 4.50,
        "audio_input_per_1m": 3.00,
        "audio_output_per_1m": 12.00,
        "is_live": True,
    },
    "gemini-2.5-pro": {
        "tier": "Premium",
        "family": "Gemini 2.5",
        "input_per_1m": 1.25,
        "output_per_1m": 10.00,
        "is_live": False,
    },
    "gemini-2.5-flash": {
        "tier": "Standard",
        "family": "Gemini 2.5",
        "input_per_1m": 0.30,
        "output_per_1m": 2.50,
        "is_live": False,
    },
    "gemini-2.0-flash": {
        "tier": "Standard",
        "family": "Gemini 2.0",
        "input_per_1m": 0.10,
        "output_per_1m": 0.40,
        "is_live": False,
    },
    "gemini-1.5-pro": {
        "tier": "Standard",
        "family": "Gemini 1.5",
        "input_per_1m": 1.25,
        "output_per_1m": 5.00,
        "is_live": False,
    },
}

# Backwards compat alias
MODEL_TIERS = {k: {"tier": v["tier"], "family": v["family"]} for k, v in MODEL_INFO.items()}

CHARS_PER_TOKEN = 4  # rough estimate for cost calculation


def _estimate_cost(
    model: str,
    input_chars: int = 0,
    output_chars: int = 0,
    duration_ms: int = 0,
    is_audio: bool = False,
) -> dict[str, Any]:
    """Estimate USD cost based on character counts and model pricing."""
    info = MODEL_INFO.get(model)
    if not info:
        return {"input_cost": 0, "output_cost": 0, "total_cost": 0, "currency": "USD"}

    input_tokens = input_chars / CHARS_PER_TOKEN
    output_tokens = output_chars / CHARS_PER_TOKEN

    if is_audio and info.get("is_live"):
        input_rate = info.get("audio_input_per_1m", info["input_per_1m"])
        output_rate = info.get("audio_output_per_1m", info["output_per_1m"])
    else:
        input_rate = info["input_per_1m"]
        output_rate = info["output_per_1m"]

    input_cost = (input_tokens / 1_000_000) * input_rate
    output_cost = (output_tokens / 1_000_000) * output_rate

    # For live sessions with duration but no char counts, estimate from duration
    if info.get("is_live") and duration_ms > 0 and input_chars == 0 and output_chars == 0:
        minutes = duration_ms / 60_000
        input_cost = minutes * 0.005   # audio input ~$0.005/min
        output_cost = minutes * 0.018  # audio output ~$0.018/min

    return {
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(input_cost + output_cost, 6),
        "currency": "USD",
    }


def track(
    *,
    model: str,
    purpose: str,
    category: str,
    session_id: str | None = None,
    input_chars: int = 0,
    output_chars: int = 0,
    duration_ms: int = 0,
    metadata: dict[str, Any] | None = None,
    is_audio: bool = False,
):
    """Record one API usage event."""
    _ensure_loaded()

    info = MODEL_INFO.get(model, {"tier": "Standard", "family": model})
    cost = _estimate_cost(model, input_chars, output_chars, duration_ms, is_audio)

    entry = {
        "id": f"u_{int(time.time() * 1000)}_{len(_log_entries)}",
        "timestamp": int(time.time() * 1000),
        "type": "usage",
        "model": model,
        "tier": info["tier"],
        "family": info["family"],
        "purpose": purpose,
        "category": category,
        "session_id": session_id,
        "input_chars": input_chars,
        "output_chars": output_chars,
        "duration_ms": duration_ms,
        "cost": cost,
        "metadata": metadata or {},
    }

    with _lock:
        _log_entries.append(entry)
        _persist()

    return entry


def track_error(
    *,
    model: str,
    purpose: str,
    category: str,
    error_message: str,
    error_type: str = "api_error",
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
):
    """Record an API error event."""
    _ensure_loaded()

    info = MODEL_INFO.get(model, {"tier": "Standard", "family": model})

    entry = {
        "id": f"e_{int(time.time() * 1000)}_{len(_log_entries)}",
        "timestamp": int(time.time() * 1000),
        "type": "error",
        "model": model,
        "tier": info["tier"],
        "family": info["family"],
        "purpose": purpose,
        "category": category,
        "session_id": session_id,
        "error_type": error_type,
        "error_message": error_message[:500],
        "cost": {"input_cost": 0, "output_cost": 0, "total_cost": 0, "currency": "USD"},
        "metadata": metadata or {},
    }

    with _lock:
        _log_entries.append(entry)
        _persist()

    return entry


def get_logs(
    limit: int = 100,
    category: str | None = None,
    session_id: str | None = None,
    log_type: str | None = None,
) -> list[dict[str, Any]]:
    """Retrieve usage logs, newest first."""
    _ensure_loaded()
    entries = _log_entries[:]

    if category:
        entries = [e for e in entries if e["category"] == category]
    if session_id:
        entries = [e for e in entries if e.get("session_id") == session_id]
    if log_type:
        entries = [e for e in entries if e.get("type", "usage") == log_type]

    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return entries[:limit]


def get_summary() -> dict[str, Any]:
    """Aggregate usage stats for dashboard display."""
    _ensure_loaded()
    entries = _log_entries[:]

    usage_entries = [e for e in entries if e.get("type", "usage") == "usage"]
    error_entries = [e for e in entries if e.get("type") == "error"]

    total_calls = len(usage_entries)
    total_errors = len(error_entries)
    total_input_chars = sum(e.get("input_chars", 0) for e in usage_entries)
    total_output_chars = sum(e.get("output_chars", 0) for e in usage_entries)
    total_cost = sum(e.get("cost", {}).get("total_cost", 0) for e in entries)

    by_model: dict[str, dict] = {}
    for e in usage_entries:
        m = e["model"]
        if m not in by_model:
            by_model[m] = {
                "model": m,
                "tier": e.get("tier", "Standard"),
                "family": e.get("family", m),
                "calls": 0,
                "errors": 0,
                "input_chars": 0,
                "output_chars": 0,
                "total_cost": 0,
            }
        by_model[m]["calls"] += 1
        by_model[m]["input_chars"] += e.get("input_chars", 0)
        by_model[m]["output_chars"] += e.get("output_chars", 0)
        by_model[m]["total_cost"] += e.get("cost", {}).get("total_cost", 0)

    for e in error_entries:
        m = e["model"]
        if m not in by_model:
            by_model[m] = {
                "model": m,
                "tier": e.get("tier", "Standard"),
                "family": e.get("family", m),
                "calls": 0,
                "errors": 0,
                "input_chars": 0,
                "output_chars": 0,
                "total_cost": 0,
            }
        by_model[m]["errors"] += 1

    by_category: dict[str, dict] = {}
    for e in entries:
        cat = e.get("category", "other")
        if cat not in by_category:
            by_category[cat] = {"calls": 0, "errors": 0, "cost": 0}
        if e.get("type") == "error":
            by_category[cat]["errors"] += 1
        else:
            by_category[cat]["calls"] += 1
        by_category[cat]["cost"] += e.get("cost", {}).get("total_cost", 0)

    sessions = set()
    session_calls = 0
    for e in usage_entries:
        if e.get("session_id"):
            sessions.add(e["session_id"])
            session_calls += 1

    return {
        "total_calls": total_calls,
        "total_errors": total_errors,
        "total_input_chars": total_input_chars,
        "total_output_chars": total_output_chars,
        "total_cost": round(total_cost, 6),
        "by_model": sorted(by_model.values(), key=lambda x: x["calls"], reverse=True),
        "by_category": by_category,
        "session_count": len(sessions),
        "session_calls": session_calls,
        "non_session_calls": total_calls - session_calls,
        "model_pricing": {
            k: {
                "tier": v["tier"],
                "family": v["family"],
                "input_per_1m": v["input_per_1m"],
                "output_per_1m": v["output_per_1m"],
            }
            for k, v in MODEL_INFO.items()
        },
    }
