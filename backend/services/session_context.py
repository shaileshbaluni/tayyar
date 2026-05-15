"""
Session Context Engine — merges client-compiled briefing with Live API operational rules.
"""

from __future__ import annotations

from typing import Any

from pipelines import gemini_live

# Prepended when a client-compiled briefing is used — binds Live model to setup steps 1–6.
LIVE_GROUNDING_PREAMBLE = (
    "=== LIVE INTERVIEW — CONTEXT BINDING ===\n"
    "The following MOCK INTERVIEW SESSION BRIEFING was compiled from the candidate's 6-step setup "
    "(candidate profile, company, role/experience, round, AI interviewer persona, language, and intensity).\n"
    "This text is injected as your systemInstruction for the entire session. You do not receive updates mid-call.\n"
    "You MUST:\n"
    "- Stay in character as the interviewer named in section 1.\n"
    "- Obey the language hard constraint in section 2 (no drift).\n"
    "- Apply intensity from section 2 to tone and follow-ups (not to skip the round arc).\n"
    "- Reference company, role level, and resume facts only from sections 3–6.\n"
    "- Follow the round phase arc in section 5 in order.\n"
    "- Never invent employers, projects, or schools not listed in section 6.\n"
)


def wrap_session_briefing(
    briefing: str,
    *,
    candidate_name: str = "Candidate",
    company: str = "",
    role: str = "",
    round_code: str = "",
    question_bank_hint: str = "",
) -> str:
    """
    Client briefing is the narrative system prompt.
    Append server-owned Live rules (metrics tool, quotas, opening calibration).
    """
    cn = (candidate_name or "").strip() or "Candidate"
    body = (briefing or "").strip()
    parts = [
        LIVE_GROUNDING_PREAMBLE + body if body else LIVE_GROUNDING_PREAMBLE,
        gemini_live.DISTINCT_QUESTION_QUOTA_RULE,
        "SPOKEN DELIVERY: Clear Indian professional English rhythm; match the LANGUAGE hard constraint in the briefing.",
        f"Operational tags: company={company}, role={role}, round={round_code}.",
        "RAPID RESPONSE: Respond within ~1 second after the candidate finishes speaking.",
        f"CLOSURE: In Phase 5, end with the exact phrase: Thanks {cn}. We'll be in touch.",
        gemini_live.build_live_metrics_block(),
        (
            "OPENING: After reading this briefing, begin live audio with a brief self-introduction "
            f"as the interviewer persona, then ask {cn} to introduce themselves. "
            "Do not mention this briefing."
        ),
    ]
    if question_bank_hint:
        parts.insert(
            2,
            f"Question bank hints (use where natural):\n{question_bank_hint}",
        )
    return "\n\n".join(p for p in parts if p)


def build_system_prompt_from_context(
    *,
    session_briefing: str | None,
    base_persona: str,
    company: str,
    role: str,
    round_code: str,
    language: str,
    question_bank_hint: str = "",
    candidate_name: str = "Candidate",
    candidate_profile: dict[str, Any] | None = None,
) -> str:
    """Prefer client briefing; fall back to legacy gemini_live builder."""
    if session_briefing and session_briefing.strip():
        return wrap_session_briefing(
            session_briefing.strip(),
            candidate_name=candidate_name,
            company=company,
            role=role,
            round_code=round_code,
            question_bank_hint=question_bank_hint,
        )
    return gemini_live.build_live_system_prompt(
        base_persona=base_persona,
        company=company,
        role=role,
        round_code=round_code,
        language=language,
        question_bank_hint=question_bank_hint,
        candidate_name=candidate_name,
        candidate_profile=candidate_profile,
    )
