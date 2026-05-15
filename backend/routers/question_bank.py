from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
import httpx
import json
import logging
import time
from config import get_settings
from services import usage_tracker

log = logging.getLogger(__name__)
router = APIRouter(prefix="/question-bank", tags=["question-bank"])
settings = get_settings()

class AnswerRequest(BaseModel):
    question: str
    profile: Dict[str, Any]

@router.post("/answer")
async def get_personalized_answer(req: AnswerRequest):
    """Generate a personalized answer based on the question and user profile."""
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API key missing")

    model = "gemini-2.5-pro"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}
    
    prompt = f"""You are an elite interview coach. Generate a personalized, "first-person" answer for the following interview question.
The candidate will use this exact answer to respond during an interview, so it must sound natural, professional, and confident.

Question:
{req.question}

Candidate Profile/Resume Data:
{json.dumps(req.profile, indent=2)}

Strategic Guidelines for the Response:
1. First-Person Perspective: Always write in the first person (e.g., "I led a team...", "My approach was...").
2. STAR Integration: Weave in a specific Situation, Task, Action, and Result from the candidate's actual projects or experience. Be specific with metrics if available in the profile.
3. Tailored Relevance: If the question is about a specific skill (e.g., React, Leadership), prioritize the most relevant project from their resume that demonstrates this.
4. Professional Authenticity: Match the candidate's experience level. If they are a fresher, emphasize learning agility and academic projects. If experienced, emphasize impact and technical depth.
5. Conversational Flow: The answer should be structured for verbal delivery—avoid overly complex sentences or academic jargon.
6. Conciseness: Aim for a response that takes 60-90 seconds to speak (roughly 150-250 words).

Output: Return ONLY the polished interview response text.
"""

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7},
    }

    t0 = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.post(url, params=params, json=body)
            r.raise_for_status()
            data = r.json()
            answer = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            usage_tracker.track(
                model=model,
                purpose="Personalized answer for question bank",
                category="question_bank",
                input_chars=len(prompt),
                output_chars=len(answer),
                duration_ms=int((time.time() - t0) * 1000),
                metadata={"question": req.question[:100]},
            )
            return {"answer": answer}
        except Exception as e:
            log.error("Personalized answer generation failed: %s", e)
            usage_tracker.track_error(
                model=model,
                purpose="Personalized answer for question bank",
                category="question_bank",
                error_message=str(e),
                error_type="api_error",
                metadata={"question": req.question[:100]},
            )
            raise HTTPException(status_code=500, detail=str(e))
