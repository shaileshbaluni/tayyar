"""
Smart turn detection for end-of-utterance after thinking pauses.

When Pipecat + pipecat smart-turn are installed, wire LocalSmartTurnAnalyzerV3
per docs: https://docs.pipecat.ai
"""

from __future__ import annotations

from typing import Any

try:
    # Import path may differ by Pipecat version — adjust after `pip install` verification.
    from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3  # type: ignore
except Exception:  # pragma: no cover
    LocalSmartTurnAnalyzerV3 = None  # type: ignore


def build_smart_turn_analyzer(**kwargs: Any):
    """Return smart-turn analyzer instance or None if dependency unavailable."""
    if LocalSmartTurnAnalyzerV3 is None:
        return None
    try:
        return LocalSmartTurnAnalyzerV3(**kwargs)
    except Exception:
        return None
