"""LLM Evaluator — Gemini 2.5 Pro powered scoring.

All subjective evaluation:
  - Per-question scoring (technical accuracy, relevance, STAR, depth)
  - Full transcript analysis (parameter scores, verdict, key moments, tips)
  - Ideal answer generation
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

from config import get_settings
from services import usage_tracker

log = logging.getLogger(__name__)


def _extract_json(text: str) -> dict[str, Any] | None:
    """Try to parse JSON from model output, stripping markdown fences if needed."""
    text = text.strip()
    # Remove ```json ... ``` wrappers
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return None


async def _gemini_call(prompt: str, purpose: str, max_tokens: int = 2048) -> dict[str, Any] | None:
    """Make a Gemini 2.5 Pro API call and return parsed JSON."""
    settings = get_settings()
    if not settings.gemini_api_key:
        log.warning("GEMINI_API_KEY not set — %s will use fallback", purpose)
        return None

    try:
        import httpx
    except ImportError:
        log.warning("httpx not installed — %s will use fallback", purpose)
        return None

    model = settings.gemini_scorecard_model or "gemini-2.5-pro"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            r = await client.post(url, params=params, json=body)

        if not r.is_success:
            usage_tracker.track_error(
                model=model, purpose=purpose,
                category="scorecard", error_message=r.text[:400],
                error_type="api_error",
            )
            log.warning("Gemini API error for %s: %s", purpose, r.text[:300])
            return None

        data = r.json()
        text = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
            .strip()
        )
        if not text:
            return None

        usage_tracker.track(
            model=model, purpose=purpose,
            category="scorecard",
            input_chars=len(prompt),
            output_chars=len(text),
            duration_ms=int((time.time() - t0) * 1000),
        )
        return _extract_json(text)

    except Exception as e:
        log.exception("Gemini call failed for %s", purpose)
        return None


# ────────────────────────────────────────────────────────────
#  Per-question scoring
# ────────────────────────────────────────────────────────────

async def score_answer_pair(question: str, answer: str) -> dict[str, Any]:
    """Score a single Q&A pair. Returns scores + feedback + ideal answer."""
    prompt = f"""You are an expert technical interviewer scoring an Indian tech candidate's answer.

Question: {question}
Candidate's Answer: {answer}

Return ONLY valid JSON with these keys:
- "technical_accuracy": integer 0-10 (how correct and deep the answer is)
- "relevance": integer 0-10 (how well it addresses the specific question)
- "star_structure": integer 0-10 (for behavioral: STAR compliance; for technical: logical structure)
- "depth": integer 0-10 (depth of knowledge shown)
- "ai_feedback": string (2-3 sentences: what was good, what was missing, what to improve)
- "ideal_answer": string (3-4 sentences: a model answer for reference)
- "tags": array of strings (skill tags like "Technical — DSA", "Behavioral — Leadership", etc.)
"""

    result = await _gemini_call(prompt, "Per-question scoring", max_tokens=1024)
    if result:
        return result

    # Fallback when Gemini is unavailable
    return {
        "technical_accuracy": 6,
        "relevance": 6,
        "star_structure": 5,
        "depth": 6,
        "ai_feedback": "LLM scoring unavailable — set GEMINI_API_KEY for real evaluation.",
        "ideal_answer": "",
        "tags": ["General"],
    }


# ────────────────────────────────────────────────────────────
#  Full transcript analysis
# ────────────────────────────────────────────────────────────

async def analyze_full_transcript(transcript_text: str, role: str) -> dict[str, Any]:
    """Analyze the complete interview transcript and produce parameter scores, verdict, tips."""
    prompt = f"""You are an expert technical interviewer evaluating a candidate for a {role} position.
Here is the full transcript of the interview:

{transcript_text}

Analyze comprehensively and return ONLY valid JSON with this structure:
{{
  "parameter_scores": {{
    "technical": {{"score": <int 0-100>, "details": "<1-2 sentences justifying>"}},
    "relevance": {{"score": <int 0-100>, "details": "<1-2 sentences justifying>"}},
    "confidence": {{"score": <int 0-100>, "details": "<1-2 sentences about delivery>"}},
    "communication": {{"score": <int 0-100>, "details": "<1-2 sentences about clarity>"}}
  }},
  "verdict": "<3-4 sentence summary of the candidate's performance>",
  "key_moments": [
    {{"timestamp": "<approx time or question #>", "type": "positive", "note": "<what they did well>"}},
    {{"timestamp": "<approx time or question #>", "type": "negative", "note": "<where they struggled>"}}
  ],
  "tips": [
    "<actionable improvement tip 1>",
    "<actionable improvement tip 2>",
    "<actionable improvement tip 3>"
  ]
}}
"""

    result = await _gemini_call(prompt, "Full transcript analysis", max_tokens=2048)
    return result or {}
