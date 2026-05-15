"""Canonical AI interviewer rows (synced with frontend mock interview + admin)."""

from __future__ import annotations

import json
import logging
from copy import deepcopy
from pathlib import Path
from typing import Any

from services.gemini_prebuilt_voices import VoicePersonaStyle

log = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parent.parent
_OVERRIDES_PATH = _ROOT / "data" / "ai_interviewer_overrides.json"

# Default gemini_voice per row: male/female matched to archetype + distinct timbres from approved list.
_DEFAULT_INTERVIEWERS: list[dict[str, Any]] = [
    {
        "id": "ai_vikram_screener",
        "baseKey": "tech-screener",
        "gender": "male",
        "displayName": "Vikram Desai",
        "personalityType": "Technical Screener",
        "title": "Senior Software Engineer",
        "experienceBand": "5–8 yrs",
        "oneLiner": "Sharp, efficient, no-nonsense. Values precision.",
        "color": "#3B82F6",
        "previewLine": "Hi, this is Vikram from the hiring team. I'll keep this screening crisp—walk me through your strongest data structure in under ninety seconds.",
        "voiceStyle": VoicePersonaStyle.FIRM_PROFESSIONAL.value,
        "geminiVoice": "Orus",
    },
    {
        "id": "ai_ananya_screener",
        "baseKey": "tech-screener",
        "gender": "female",
        "displayName": "Ananya Iyer",
        "personalityType": "Technical Screener",
        "title": "Senior Software Engineer",
        "experienceBand": "5–8 yrs",
        "oneLiner": "Sharp, efficient, no-nonsense. Values precision.",
        "color": "#3B82F6",
        "previewLine": "Hello—I'm Ananya. We'll move quickly through fundamentals today; when you're ready, give me a sixty-second snapshot of what you've shipped most recently.",
        "voiceStyle": VoicePersonaStyle.FIRM_PROFESSIONAL.value,
        "geminiVoice": "Kore",
    },
    {
        "id": "ai_arjun_deep",
        "baseKey": "tech-deep-dive",
        "gender": "male",
        "displayName": "Arjun Krishnamurthy",
        "personalityType": "Technical Deep Dive",
        "title": "Principal Engineer / Architect",
        "experienceBand": "10–15 yrs",
        "oneLiner": "Deeply curious, Socratic method, loves trade-offs.",
        "color": "#8B5CF6",
        "previewLine": "I'm Arjun. Pick one system you actually built—we'll peel it layer by layer. I'm less interested in buzzwords than in the trade-offs you rejected.",
        "voiceStyle": VoicePersonaStyle.INFORMATIVE_CLEAR.value,
        "geminiVoice": "Fenrir",
    },
    {
        "id": "ai_kavitha_deep",
        "baseKey": "tech-deep-dive",
        "gender": "female",
        "displayName": "Kavitha Nair",
        "personalityType": "Technical Deep Dive",
        "title": "Principal Engineer / Architect",
        "experienceBand": "10–15 yrs",
        "oneLiner": "Deeply curious, Socratic method, loves trade-offs.",
        "color": "#8B5CF6",
        "previewLine": "Hi, Kavitha here. Before we design anything new, I want to understand how you thought through failure modes in a system you owned end to end.",
        "voiceStyle": VoicePersonaStyle.INFORMATIVE_CLEAR.value,
        "geminiVoice": "Erinome",
    },
    {
        "id": "ai_rajesh_hm",
        "baseKey": "hiring-manager",
        "gender": "male",
        "displayName": "Rajesh Mehta",
        "personalityType": "Hiring Manager",
        "title": "Engineering Manager / Director",
        "experienceBand": "12–18 yrs",
        "oneLiner": "Strategic thinker, evaluates leadership + impact.",
        "color": "#10B981",
        "previewLine": "I'm Rajesh. Help me connect your last role to business outcomes—what metric moved because of your decision, and what would you do differently?",
        "voiceStyle": VoicePersonaStyle.INFORMATIVE_CLEAR.value,
        "geminiVoice": "Iapetus",
    },
    {
        "id": "ai_sunita_hm",
        "baseKey": "hiring-manager",
        "gender": "female",
        "displayName": "Sunita Sharma",
        "personalityType": "Hiring Manager",
        "title": "Engineering Manager / Director",
        "experienceBand": "12–18 yrs",
        "oneLiner": "Strategic thinker, evaluates leadership + impact.",
        "color": "#10B981",
        "previewLine": "Sunita speaking. Tell me about a time you influenced without authority—what was at stake, who resisted, and how you measured success?",
        "voiceStyle": VoicePersonaStyle.INFORMATIVE_CLEAR.value,
        "geminiVoice": "Despina",
    },
    {
        "id": "ai_aditya_hr",
        "baseKey": "hr-representative",
        "gender": "male",
        "displayName": "Aditya Kapoor",
        "personalityType": "HR Representative",
        "title": "HR Business Partner",
        "experienceBand": "6–10 yrs",
        "oneLiner": "Warm, empathetic, reads between the lines.",
        "color": "#F59E0B",
        "previewLine": "Hi, I'm Aditya from HR. I want this to feel like a conversation—what drew you to this role, and what would make you say yes if we moved forward?",
        "voiceStyle": VoicePersonaStyle.FRIENDLY_WARM.value,
        "geminiVoice": "Achird",
    },
    {
        "id": "ai_meera_hr",
        "baseKey": "hr-representative",
        "gender": "female",
        "displayName": "Meera Joshi",
        "personalityType": "HR Representative",
        "title": "HR Business Partner",
        "experienceBand": "6–10 yrs",
        "oneLiner": "Warm, empathetic, reads between the lines.",
        "color": "#F59E0B",
        "previewLine": "Hello, Meera here. Help me understand how you recharge under pressure, and what kind of manager brings out your best work.",
        "voiceStyle": VoicePersonaStyle.FRIENDLY_WARM.value,
        "geminiVoice": "Sulafat",
    },
    {
        "id": "ai_sanjay_vp",
        "baseKey": "department-head",
        "gender": "male",
        "displayName": "Sanjay Venkatesh",
        "personalityType": "Department Head / VP",
        "title": "VP / SVP Engineering",
        "experienceBand": "18–25 yrs",
        "oneLiner": "Executive presence, big-picture, direct.",
        "color": "#EF4444",
        "previewLine": "Sanjay here. In one minute: why should we bet a multi-year roadmap on your judgment—what have you shipped that proves you think in horizons, not tickets?",
        "voiceStyle": VoicePersonaStyle.MATURE_GRAVELLY.value,
        "geminiVoice": "Gacrux",
    },
    {
        "id": "ai_priya_vp",
        "baseKey": "department-head",
        "gender": "female",
        "displayName": "Priya Raghavan",
        "personalityType": "Department Head / VP",
        "title": "VP / SVP Engineering",
        "experienceBand": "18–25 yrs",
        "oneLiner": "Executive presence, big-picture, direct.",
        "color": "#EF4444",
        "previewLine": "Priya speaking. If you had to sunset a product line your team loved, how would you sequence the narrative to the org without losing trust?",
        "voiceStyle": VoicePersonaStyle.MATURE_GRAVELLY.value,
        "geminiVoice": "Vindemiatrix",
    },
]


def _load_overrides() -> dict[str, dict[str, Any]]:
    try:
        if not _OVERRIDES_PATH.exists():
            return {}
        data = json.loads(_OVERRIDES_PATH.read_text(encoding="utf-8"))
        inv = data.get("interviewers")
        if isinstance(inv, dict):
            return {str(k): v for k, v in inv.items() if isinstance(v, dict)}
    except Exception as e:
        log.warning("ai_interviewer_overrides load failed: %s", e)
    return {}


def _save_overrides(ov: dict[str, dict[str, Any]]) -> None:
    _OVERRIDES_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"interviewers": ov}
    _OVERRIDES_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def list_interviewers() -> list[dict[str, Any]]:
    """Merged default + server-side overrides (used by GET /ai-interviewers)."""
    ov = _load_overrides()
    out: list[dict[str, Any]] = []
    for row in deepcopy(_DEFAULT_INTERVIEWERS):
        extra = ov.get(row["id"])
        if extra:
            row.update({k: v for k, v in extra.items() if v is not None})
        out.append(row)
    return out


def get_interviewer(interviewer_id: str) -> dict[str, Any] | None:
    for r in list_interviewers():
        if r["id"] == interviewer_id:
            return r
    return None


def merge_overrides(patches: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    cur = _load_overrides()
    for iid, patch in patches.items():
        if not isinstance(patch, dict):
            continue
        merged = {**(cur.get(iid) or {}), **patch}
        cur[iid] = merged
    _save_overrides(cur)
    return cur


def resolve_voice_for_session(
    *,
    voice_name: str | None,
    live_voice_name: str | None,
    ai_interviewer_id: str | None,
    persona_gender: str | None = None,
) -> str:
    """Resolve Gemini prebuilt voice; gender-snap only when the client repeats the catalog default."""
    from services.gemini_prebuilt_voices import normalize_voice_name, snap_voice_to_gender

    inv = get_interviewer(ai_interviewer_id) if ai_interviewer_id else None
    gender = (inv.get("gender") if inv else None) or persona_gender
    g = str(gender) if gender else None

    catalog_voice: str | None = None
    if inv and inv.get("geminiVoice"):
        catalog_voice = normalize_voice_name(str(inv["geminiVoice"]))

    explicit = False
    vn: str | None = None
    # Prefer live_voice_name: it is the dedicated Live TTS field from setup; voice_name is legacy / duplicates.
    for candidate in (live_voice_name, voice_name):
        if candidate and str(candidate).strip():
            vn = normalize_voice_name(str(candidate))
            explicit = True
            break

    if not explicit:
        vn = catalog_voice
    if vn is None:
        vn = normalize_voice_name(None)

    # Client repeated the persona default → allow gender snap (corrects bad catalog timbre).
    # Client chose a different voice (setup override) → use it exactly.
    if explicit and catalog_voice is not None and vn == catalog_voice:
        return snap_voice_to_gender(vn, g)
    if explicit:
        return vn
    if catalog_voice is not None:
        return snap_voice_to_gender(catalog_voice, g)
    return snap_voice_to_gender(vn, g)
