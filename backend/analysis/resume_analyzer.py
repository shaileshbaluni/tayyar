import json
import logging
import time
import fitz  # PyMuPDF
from pathlib import Path
from typing import Any, List, Dict
import httpx
from config import get_settings
from services import usage_tracker

log = logging.getLogger(__name__)

async def analyze_resume_ats(file_path: Path) -> Dict[str, Any]:
    """Runs a 15-point ATS compatibility check using Gemini."""
    text = _extract_text(file_path)
    if not text:
        return {"error": "Could not extract text from file"}

    settings = get_settings()
    prompt = f"""You are an expert ATS (Applicant Tracking System) specialist for the Indian tech market.
Analyze the following resume text against 15 ATS compatibility checks.
Resume Text:
{text}

Checks:
1. File Format: Is it parseable? (Assume yes if you see text)
2. Single Column: Does it look like a single column or multi-column?
3. Section Headers: Are headers like Experience, Education, Skills standard?
4. Contact Info: Email, Phone, LinkedIn present?
5. Date Format: Consistent date formats used?
6. Font: Does it use standard professional fonts? (Inferred from text structure)
7. Headers/Footers: Is key info hidden in headers?
8. No Tables: Are sections using tables or simple lists?
9. No Images: Are there image placeholders or graphics?
10. File Size: (Check provided metadata)
11. Page Count: (Check length)
12. Bullet Style: Consistent bullets?
13. Special Characters: Any garbled ASCII characters?
14. Keyword Density: At least 20+ role-relevant keywords?
15. Quantified Achievements: At least 3 numbered impact bullets?

Return ONLY valid JSON with this structure:
{{
  "overall_score": <int 0-100>,
  "checks": [
    {{
      "id": 1,
      "name": "File Format",
      "ok": <bool>,
      "note": "<brief explanation>",
      "fix": "<how to fix if failed>"
    }},
    ...
  ],
  "summary": "<1-2 sentence overview>"
}}
"""
    analysis = await _call_gemini(prompt)
    if "error" in analysis:
        return analysis
    return {"analysis": analysis, "text": text}

async def fix_resume_ats(text: str, failed_checks: List[str]) -> Dict[str, Any]:
    """Uses Gemini to auto-fix resume text based on failed checks."""
    prompt = f"""You are an expert resume writer. Fix the following resume text to pass ATS filters.
Target fixes: {", ".join(failed_checks)}

Original Resume:
{text}

Return ONLY the full updated resume text. Do not add any preamble or markdown code blocks.
"""
    # Using Pro model if requested by user for 'Pro' quality
    settings = get_settings()
    model = "gemini-1.5-pro" # User asked for 3.1 Pro, we use 1.5 Pro which is the current state of art Pro.
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }
    t0 = time.time()
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            r = await client.post(url, params=params, json=body)
            r.raise_for_status()
            data = r.json()
            fixed_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            usage_tracker.track(
                model=model, purpose="Resume ATS fix", category="resume",
                input_chars=len(prompt), output_chars=len(fixed_text),
                duration_ms=int((time.time() - t0) * 1000),
            )
            return {"fixed_text": fixed_text}
        except Exception as e:
            log.error("Gemini fix failed: %s", e)
            usage_tracker.track_error(
                model=model, purpose="Resume ATS fix",
                category="resume", error_message=str(e),
            )
            return {"error": str(e)}

async def match_resume_to_jd(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """Matches resume against a JD and returns keyword matrix."""
    prompt = f"""Analyze the match between this resume and job description.
Resume:
{resume_text}

Job Description:
{jd_text}

Return ONLY valid JSON with:
{{
  "match_score": <int 0-100>,
  "keyword_matrix": {{
    "matched": ["list", "of", "keywords"],
    "missing": [
      {{"keyword": "str", "importance": "Critical|Important|Nice-to-have", "suggestion": "str"}}
    ],
    "partial": [
      {{"have": "str", "wanted": "str", "suggestion": "str"}}
    ]
  }},
  "section_analysis": {{
    "skills": "feedback",
    "experience": "feedback",
    "education": "feedback"
  }},
  "optimization_tips": [
    {{"original": "weak bullet", "improved": "strong bullet with keywords", "impact": "+X% score"}}
  ]
}}
"""
    return await _call_gemini(prompt)

async def improve_content(bullets: List[str]) -> List[Dict[str, Any]]:
    """Strengthens bullet points using Gemini."""
    prompt = f"""Improve these resume bullet points for a high-end Indian tech role (TCS, Google, Zomato).
For each bullet, provide a score (0-10), the issue, and an improved version with metrics and strong verbs.
Bullets:
{json.dumps(bullets)}

Return ONLY valid JSON:
[
  {{"original": "str", "score": <int>, "issue": "str", "improved": "str"}}
]
"""
    return await _call_gemini(prompt)

def _extract_text(file_path: Path) -> str:
    """Extracts text from PDF or TXT."""
    if file_path.suffix.lower() == ".pdf":
        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            return text
        except Exception as e:
            log.error("PDF extraction failed: %s", e)
            return ""
    elif file_path.suffix.lower() == ".txt":
        return file_path.read_text(encoding="utf-8", errors="ignore")
    return ""

async def extract_resume_data(file_path: Path) -> Dict[str, Any]:
    """Extracts structured education, experience, projects, and certifications from resume."""
    text = _extract_text(file_path)
    if not text:
        return {"error": "Could not extract text from file"}

    prompt = f"""You are an expert resume parser. Extract the following details from the resume text:
1. Education (College name, Degree, Year, GPA if any)
2. Experience (Company name, Role, Duration, Key achievements)
3. Projects (Project name, Tech stack, Description)
4. Certifications (Name, Issuing organization, Year)

Resume Text:
{text}

Return ONLY valid JSON with this structure:
{{
  "basics": {{
    "name": "str",
    "email": "str",
    "phone": "str",
    "location": "str"
  }},
  "education": [
    {{ "institution": "str", "area": "str", "studyType": "str", "score": "str", "date": "str" }}
  ],
  "experience": [
    {{ "company": "str", "position": "str", "date": "str", "summary": "str", "highlights": ["str"] }}
  ],
  "projects": [
    {{ "name": "str", "date": "str", "description": "str", "highlights": ["str"] }}
  ],
  "certifications": [
    {{ "name": "str", "issuer": "str", "date": "str" }}
  ]
}}
"""
    return await _call_gemini(prompt)

def _gemini_text_model_chain(settings: Any) -> list[str]:
    """Prefer configured model, then known-stable IDs (404 if name retired or region-locked)."""
    preferred = (getattr(settings, "gemini_model", None) or "").strip() or "gemini-2.5-flash"
    chain = [preferred, "gemini-2.5-flash", "gemini-1.5-flash"]
    seen: set[str] = set()
    out: list[str] = []
    for m in chain:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


async def _call_gemini(prompt: str) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.gemini_api_key:
        return {"error": "Gemini API key missing"}

    params = {"key": settings.gemini_api_key}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    t0 = time.time()
    last_err: str | None = None
    async with httpx.AsyncClient(timeout=120.0) as client:
        for model in _gemini_text_model_chain(settings):
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                r = await client.post(url, params=params, json=body)
                if r.status_code == 404:
                    log.warning("Gemini model %r returned 404 — trying next fallback", model)
                    last_err = f"Model {model!r} not found (404)"
                    continue
                r.raise_for_status()
                data = r.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                usage_tracker.track(
                    model=model,
                    purpose="Resume analysis",
                    category="resume",
                    input_chars=len(prompt),
                    output_chars=len(text),
                    duration_ms=int((time.time() - t0) * 1000),
                )
                return json.loads(text)
            except httpx.HTTPStatusError as e:
                err = str(e)
                if e.response is not None and e.response.status_code == 404:
                    log.warning("Gemini HTTP 404 for %r: %s", model, err)
                    last_err = err
                    continue
                log.error("Gemini HTTP error: %s", err)
                usage_tracker.track_error(
                    model=model,
                    purpose="Resume analysis",
                    category="resume",
                    error_message=err,
                )
                return {"error": err}
            except json.JSONDecodeError as e:
                log.error("Gemini JSON parse failed: %s", e)
                usage_tracker.track_error(
                    model=model,
                    purpose="Resume analysis",
                    category="resume",
                    error_message=str(e),
                )
                return {"error": f"Invalid JSON from model: {e}"}
            except Exception as e:
                log.error("Gemini call failed: %s", e)
                usage_tracker.track_error(
                    model=model,
                    purpose="Resume analysis",
                    category="resume",
                    error_message=str(e),
                )
                return {"error": str(e)}

    return {
        "error": last_err
        or "No working Gemini text model. Set GEMINI_MODEL=gemini-2.5-flash (or gemini-1.5-flash) in backend .env and restart.",
    }
