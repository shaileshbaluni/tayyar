"""REST: canonical AI interviewer catalog + server-side overrides (admin sync)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services import ai_interviewer_catalog as cat
from services.gemini_prebuilt_voices import list_all_gemini_live_voices, list_voice_styles

router = APIRouter(prefix="/ai-interviewers", tags=["ai-interviewers"])


@router.get("")
def get_interviewers():
    return {
        "interviewers": cat.list_interviewers(),
        "voiceStyles": list_voice_styles(),
        "allGeminiVoices": list_all_gemini_live_voices(),
    }


class OverridesBody(BaseModel):
    """Per-interviewer patches (e.g. geminiVoice, displayName). Merged into data/ai_interviewer_overrides.json."""

    patches: dict[str, dict[str, Any]] = Field(default_factory=dict)


@router.put("/overrides")
def put_overrides(body: OverridesBody):
    if not body.patches:
        raise HTTPException(400, "patches required")
    cat.merge_overrides(body.patches)
    return {"ok": True, "interviewers": cat.list_interviewers()}
