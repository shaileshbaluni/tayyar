import json
from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Dict, Any
from analysis import linkedin_analyzer
from config import get_settings

router = APIRouter(prefix="/linkedin", tags=["linkedin"])
settings = get_settings()

@router.post("/import-url")
async def import_url(url: str = Body(..., embed=True)):
    """Fetch and parse public LinkedIn profile from URL."""
    try:
        result = await linkedin_analyzer.fetch_public_profile(url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audit")
async def audit_profile(profile_data: Dict[str, Any]):
    """Analyze profile data and return scores/issues."""
    result = await linkedin_analyzer.analyze_profile(profile_data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/generate/headlines")
async def generate_headlines(current_role: str = Body(...), target_role: str = Body(...)):
    """Generate 5 headline variations."""
    result = await linkedin_analyzer.generate_headlines(current_role, target_role)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/generate/about")
async def generate_about(user_info: Dict[str, str]):
    """Generate 3 About section variations."""
    result = await linkedin_analyzer.generate_about_section(user_info)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/improve/experience")
async def improve_experience(experience_entry: Dict[str, Any]):
    """Improve experience bullets."""
    result = await linkedin_analyzer.improve_experience(experience_entry)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/generate/calendar")
async def generate_calendar(params: Dict[str, Any]):
    """Generate 30-day content calendar."""
    result = await linkedin_analyzer.generate_content_calendar(params)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/generate/scratch")
async def generate_scratch(data: Dict[str, Any]):
    """Generate a complete profile from scratch."""
    # This uses a comprehensive prompt to build everything at once
    prompt = f"""You are an expert LinkedIn profile builder. Based on the following rough info, generate a COMPLETE LinkedIn profile.
Rough Info:
{json.dumps(data, indent=2)}

Include: Headline, About, Experience (2-3 entries), Skills (15-20), Education.
Return ONLY valid JSON with sections pre-filled.
"""
    result = await linkedin_analyzer._call_gemini(prompt)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

