"""Normalize scorecard dict for frontend consumption."""

from __future__ import annotations

from typing import Any


def format_report(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure all required top-level keys exist for the React Scorecard page."""
    raw.setdefault("overall_score", 0)
    raw.setdefault("parameter_scores", {})
    raw.setdefault("question_breakdown", [])
    raw.setdefault("trend_data", {})
    raw.setdefault("key_moments", [])
    raw.setdefault("tips", [])
    raw.setdefault("meta", {})
    raw.setdefault("verdict", "")
    return raw
