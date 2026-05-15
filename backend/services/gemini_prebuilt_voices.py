"""
Google Gemini Live prebuilt voice names + Tayyar style buckets.

Official HD voice catalog (30 names) matches Google Cloud / Firebase Live API docs
and applies to models including **gemini-3.1-flash-live-preview** (same `voiceName` set).

Indian accent is steered in the Live system prompt; `voiceName` selects synthesis timbre.
"""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Final

log = logging.getLogger(__name__)

# ── Style buckets (for docs + admin UI; pick voices by interview archetype) ──
class VoicePersonaStyle(StrEnum):
    FIRM_PROFESSIONAL = "firm_professional"  # technical / strict
    INFORMATIVE_CLEAR = "informative_clear"  # standard deep-dive
    FRIENDLY_WARM = "friendly_warm"  # HR / behavioural
    MATURE_GRAVELLY = "mature_gravelly"  # senior exec
    UPBEAT_LIVELY = "upbeat_lively"


# Exact 30 names from Google Live API voice tables (Vertex / Firebase / AI Logic).
# https://cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-language-voice
GEMINI_FLASH_LIVE_PREBUILT_VOICES: Final[tuple[str, ...]] = (
    "Zephyr",
    "Kore",
    "Orus",
    "Autonoe",
    "Umbriel",
    "Erinome",
    "Laomedeia",
    "Schedar",
    "Achird",
    "Sadachbia",
    "Puck",
    "Fenrir",
    "Aoede",
    "Enceladus",
    "Algieba",
    "Algenib",
    "Achernar",
    "Gacrux",
    "Zubenelgenubi",
    "Sadaltager",
    "Charon",
    "Leda",
    "Callirrhoe",
    "Iapetus",
    "Despina",
    "Rasalgethi",
    "Alnilam",
    "Pulcherrima",
    "Vindemiatrix",
    "Sulafat",
)

ALLOWED_GEMINI_LIVE_VOICES: Final[frozenset[str]] = frozenset(GEMINI_FLASH_LIVE_PREBUILT_VOICES)

_VOICE_BY_LOWER: Final[dict[str, str]] = {v.lower(): v for v in GEMINI_FLASH_LIVE_PREBUILT_VOICES}

VOICES_BY_STYLE: Final[dict[VoicePersonaStyle, tuple[str, ...]]] = {
    VoicePersonaStyle.FIRM_PROFESSIONAL: ("Kore", "Orus", "Alnilam"),
    VoicePersonaStyle.INFORMATIVE_CLEAR: ("Charon", "Iapetus", "Erinome", "Rasalgethi", "Fenrir"),
    VoicePersonaStyle.FRIENDLY_WARM: ("Achird", "Sulafat", "Aoede", "Callirrhoe"),
    VoicePersonaStyle.MATURE_GRAVELLY: ("Gacrux", "Algenib", "Vindemiatrix", "Despina"),
    VoicePersonaStyle.UPBEAT_LIVELY: ("Puck", "Laomedeia", "Sadachbia"),
}

# Timbre gender for Live prebuilt voices (Google does not publish a formal API field).
MALE_LIVE_VOICES: Final[frozenset[str]] = frozenset(
    {
        "Orus",
        "Fenrir",
        "Iapetus",
        "Sadaltager",
        "Gacrux",
        "Algenib",
        "Rasalgethi",
        "Achird",
        "Alnilam",
        "Puck",
        "Zubenelgenubi",
    }
)
FEMALE_LIVE_VOICES: Final[frozenset[str]] = frozenset(
    {
        "Kore",
        "Erinome",
        "Aoede",
        "Leda",
        "Sulafat",
        "Vindemiatrix",
        "Despina",
        "Autonoe",
        "Callirrhoe",
        "Laomedeia",
        "Pulcherrima",
        "Achernar",
        "Enceladus",
        "Sadachbia",
    }
)


def normalize_voice_name(name: str | None, *, fallback: str = "Kore") -> str:
    """Return a Gemini Live prebuilt voice name safe for gemini-3.1-flash-live-preview (and peers)."""
    raw = (name or "").strip()
    if raw in ALLOWED_GEMINI_LIVE_VOICES:
        return raw
    canon = _VOICE_BY_LOWER.get(raw.lower())
    if canon:
        return canon
    fb = fallback if fallback in ALLOWED_GEMINI_LIVE_VOICES else "Kore"
    if raw:
        log.warning(
            "Gemini Live voice %r is not in the official 30-name catalog; using %r instead. "
            "See GEMINI_FLASH_LIVE_PREBUILT_VOICES / Vertex Live API voice list.",
            raw,
            fb,
        )
    return fb


def _voice_gender_class(voice: str) -> str:
    if voice in MALE_LIVE_VOICES:
        return "male"
    if voice in FEMALE_LIVE_VOICES:
        return "female"
    return "neutral"


def _first_same_style_voice(voice: str, *, want_male: bool) -> str | None:
    """Pick the first same-style voice whose timbre matches the requested gender."""
    want = MALE_LIVE_VOICES if want_male else FEMALE_LIVE_VOICES
    for style, names in VOICES_BY_STYLE.items():
        if voice not in names:
            continue
        for n in names:
            if n in want:
                return n
        if style == VoicePersonaStyle.MATURE_GRAVELLY:
            return "Gacrux" if want_male else "Vindemiatrix"
        return None
    return None


def snap_voice_to_gender(voice: str | None, persona_gender: str | None) -> str:
    """Align prebuilt voice timbre with interviewer gender (male vs female)."""
    vn = normalize_voice_name(voice)
    g = (persona_gender or "").strip().lower()
    if g not in ("male", "female"):
        return vn
    want_male = g == "male"
    cls = _voice_gender_class(vn)
    if (want_male and cls == "male") or (not want_male and cls == "female"):
        return vn
    repl = _first_same_style_voice(vn, want_male=want_male)
    return repl if repl else ("Orus" if want_male else "Kore")


def list_voice_styles() -> dict[str, list[str]]:
    """Expose style → voice names for admin / API."""
    return {k.value: list(v) for k, v in VOICES_BY_STYLE.items()}


def list_all_gemini_live_voices() -> list[str]:
    """Full official prebuilt voiceName list for Gemini Live (same names session + WS use)."""
    return list(GEMINI_FLASH_LIVE_PREBUILT_VOICES)
