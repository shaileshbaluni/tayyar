import json
import logging
import time
import asyncio
from typing import Any, List, Dict, Optional
import httpx
from config import get_settings
from services import usage_tracker

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a LinkedIn profile writing expert for the Indian job market. 
You write professional, keyword-rich, authentic LinkedIn content that helps candidates get noticed by Indian recruiters. 
Tone: professional but human. 
Context-aware for Indian companies, Indian salary norms, Indian career paths, and Hinglish professional communication style."""

async def analyze_profile(profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyzes a LinkedIn profile and returns scores and issues for each component."""
    prompt = f"""{SYSTEM_PROMPT}
Analyze the following LinkedIn profile data. Score each of the 9 components (0-100) and identify specific issues.

Profile Data:
{json.dumps(profile_data, indent=2)}

Components to Audit:
1. Headline (Weight: 15%)
2. Profile Photo (Weight: 5%)
3. Banner Image (Weight: 5%)
4. About Section (Weight: 20%)
5. Experience (Weight: 25%)
6. Skills (Weight: 10%)
7. Education (Weight: 5%)
8. Recommendations (Weight: 10%)
9. Activity & Posts (Weight: 5%)

Return ONLY valid JSON with this structure:
{{
  "overall_score": <int 0-100>,
  "percentile": <int 1-99>,
  "components": [
    {{
      "name": "Headline",
      "score": <int>,
      "status": "Strong|Needs Work|Empty",
      "issues": ["str"],
      "quick_fix": "str"
    }},
    ... (all 9 components)
  ],
  "summary": "str"
}}
"""
    return await _call_gemini(prompt)

async def generate_headlines(current_role: str, target_role: str) -> Dict[str, Any]:
    """Generates 5 versions of LinkedIn headlines based on different strategies."""
    prompt = f"""{SYSTEM_PROMPT}
Generate 5 versions of a LinkedIn headline for someone currently in the role '{current_role}' targeting the role '{target_role}'.

Strategies:
1. Recruiter Search Optimised: Best for active job hunting. Front-load keywords.
2. Personal Brand: Best for thought leadership. Unique value proposition.
3. Open to Work: Signals availability without using the #OpenToWork frame.
4. Thought Leader: Best for content creators. Impact-oriented.
5. Career Transition: Best for switching industries or roles.

Return ONLY valid JSON:
{{
  "versions": [
    {{
      "strategy": "Recruiter Search Optimised",
      "tag": "Best for: Active Job Hunting",
      "text": "str",
      "char_count": <int>,
      "keywords_covered": ["str"],
      "why_it_works": "str"
    }},
    ... (5 versions)
  ],
  "keywords": [
    {{"text": "str", "volume": "High|Medium|Low", "status": "Missing"}}
  ]
}}
"""
    return await _call_gemini(prompt)

async def generate_about_section(user_info: Dict[str, str]) -> Dict[str, Any]:
    """Generates 3 versions of an About section."""
    prompt = f"""{SYSTEM_PROMPT}
Write 3 versions of a LinkedIn About section based on this info:
About Me: {user_info.get('about_me', '')}
Achievements: {user_info.get('achievements', '')}
Looking for: {user_info.get('looking_for', '')}

Versions:
A. The Storyteller: Narrative, hook-based, journey-focused.
B. The Data-Driven Professional: Value statement, bullet points, quantified impact.
C. The Career Narrative: Structured journey from Education to Future goals.

Return ONLY valid JSON:
{{
  "versions": [
    {{
      "id": "A",
      "name": "The Storyteller",
      "text": "str",
      "word_count": <int>,
      "keywords": ["str"],
      "missing_keywords": ["str"]
    }},
    ... (3 versions)
  ]
}}
"""
    return await _call_gemini(prompt)

async def improve_experience(experience_entry: Dict[str, Any]) -> Dict[str, Any]:
    """Improves bullet points for a single experience entry."""
    prompt = f"""{SYSTEM_PROMPT}
Improve the bullet points for this experience entry:
Role: {experience_entry.get('position')} at {experience_entry.get('company')}
Description: {experience_entry.get('summary')}

Provide a score for the current description and improved versions of each bullet.
Use strong action verbs, quantify impact, and mention tech stack.

Return ONLY valid JSON:
{{
  "current_score": <int 0-10>,
  "bullets": [
    {{
      "original": "str",
      "score": <int>,
      "improved": "str",
      "impact": "str"
    }}
  ]
}}
"""
    return await _call_gemini(prompt)

async def generate_content_calendar(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generates a 30-day LinkedIn content calendar."""
    prompt = f"""{SYSTEM_PROMPT}
Generate a 30-day LinkedIn content calendar for a {params.get('role')} targeting {params.get('target_companies')}.
Experience Level: {params.get('experience_level')}
Goal: {params.get('goal')}

For each day, provide a topic, content type, and optimal time. Also generate a FULL DRAFT post for Day 1, Day 3, and Day 7 as examples.

Return ONLY valid JSON:
{{
  "calendar": [
    {{
      "day": <int>,
      "type": "Tutorial|Career Insight|Project Showcase|Industry Opinion|Personal Story|Poll|Curated Share",
      "topic": "str",
      "time": "str",
      "draft": "optional full post text"
    }},
    ... (30 days)
  ]
}}
"""
    return await _call_gemini(prompt)

async def fetch_public_profile(url: str) -> Dict[str, Any]:
    """Simulates fetching a public LinkedIn profile."""
    # In a real app, this would use a scraper or a service like Proxycurl
    # For this implementation, we simulate the fetch delay and return realistic mock data if it fails
    await asyncio.sleep(3) # Simulate network delay
    
    # Mock data based on a generic tech professional
    return {
        "headline": "Software Engineer at TCS | Python | AWS | Backend Developer",
        "about": "I build things. Experienced in Python and web development.",
        "experience": [
            {
                "company": "TCS",
                "position": "Software Engineer",
                "date": "Jan 2022 - Present",
                "summary": "Working on backend development for a banking client."
            }
        ],
        "skills": ["Python", "JavaScript", "SQL", "Git"],
        "education": [
            {
                "institution": "Anna University",
                "area": "Computer Science",
                "studyType": "B.E.",
                "date": "2017 - 2021"
            }
        ],
        "photo_present": True,
        "banner_present": False
    }

async def _call_gemini(prompt: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return {"error": "Gemini API key missing"}

    # Use Pro model for better LinkedIn content as per spec
    model = "gemini-2.0-pro-exp-02-05" # Attempting to use the latest pro model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7, 
            "responseMimeType": "application/json"
        },
    }
    t0 = time.time()
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            r = await client.post(url, params=params, json=body)
            r.raise_for_status()
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            usage_tracker.track(
                model=model, purpose="LinkedIn optimization",
                category="linkedin", input_chars=len(prompt),
                output_chars=len(text),
                duration_ms=int((time.time() - t0) * 1000),
            )
            return json.loads(text)
        except Exception as e:
            log.error("Gemini LinkedIn call failed: %s", e)
            # Fallback to flash if pro fails or is unavailable
            if "model" in str(e) or r.status_code == 404:
                return await _call_gemini_flash(prompt)
            return {"error": str(e)}

async def _call_gemini_flash(prompt: str) -> Dict[str, Any]:
    settings = get_settings()
    model = "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, params=params, json=body)
        r.raise_for_status()
        data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return json.loads(text)

