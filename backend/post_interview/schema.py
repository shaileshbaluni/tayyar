"""Constants and shared definitions for the post-interview pipeline."""

from __future__ import annotations

# ── Calibration ──
CALIBRATION_SEC = 10.0  # first 10 s treated as warm-up baseline

# ── Video encoding ──
MASTER_VIDEO_FPS = 25
PROXY_FPS = 15
PROXY_MAX_HEIGHT = 480

# ── Voice analysis ──
PARSELMOUTH_FRAME_MS = 250  # 250 ms frames

# ── Scoring weights (Section 4.3.1) ──
WEIGHTS: dict[str, float] = {
    "communication": 0.20,
    "technical": 0.25,
    "confidence": 0.15,
    "relevance": 0.20,
    "filler_words": 0.10,
    "body_language": 0.10,
}

# ── Curated filler lexicon (English + Indian English) ──
FILLER_LEXICON: list[str] = [
    # Standard English
    "um", "uh", "umm", "uhh", "hmm",
    "like", "you know", "basically", "actually", "literally",
    "sort of", "kind of", "i mean", "right", "okay so", "so yeah",
    "well", "erm",
    # Indian English specific
    "matlab", "yaani", "acha", "toh", "na",
    "hai na", "right na", "so basically", "means",
]

# ── Interviewer / candidate role labels ──
INTERVIEWER_ROLES = frozenset({"interviewer", "AI", "assistant", "model", "MODEL", "system"})
CANDIDATE_ROLES = frozenset({"candidate", "USER", "user"})
