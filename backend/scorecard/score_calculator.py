"""Weighted overall score from parameter blocks.

Six parameters (Section 4.3.1), renormalized when video is disabled.
"""

from __future__ import annotations

from typing import Any

from post_interview.schema import WEIGHTS


def overall_score(
    parameter_scores: dict[str, dict[str, Any] | None],
    *,
    include_body_language: bool = True,
) -> int:
    """Weighted 0-100 overall score.

    When video is disabled, pass ``include_body_language=False`` so the
    remaining five parameters are renormalized to sum to 100%.
    """
    active = {k: v for k, v in WEIGHTS.items() if include_body_language or k != "body_language"}
    weight_sum = sum(active.values())
    if weight_sum <= 0:
        return 0
    total = 0.0
    for key, w in active.items():
        block = parameter_scores.get(key) or {}
        s = float(block.get("score", 0) if isinstance(block, dict) else 0)
        total += s * (w / weight_sum)
    return int(round(total))
