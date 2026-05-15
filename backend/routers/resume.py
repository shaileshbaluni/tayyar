from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import List, Optional
import os
from pathlib import Path
import shutil
from analysis import resume_analyzer
from config import get_settings

router = APIRouter(prefix="/resume", tags=["resume"])
settings = get_settings()

@router.post("/analyze")
async def analyze_resume(file: UploadFile = File(...)):
    """Upload and run 15-point ATS check."""
    temp_dir = Path(settings.storage_dir) / "temp_resumes"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = temp_dir / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        result = await resume_analyzer.analyze_resume_ats(file_path)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    finally:
        if file_path.exists():
            os.remove(file_path)

@router.post("/fix")
async def fix_resume(resume_text: str, failed_checks: List[str]):
    """Auto-fix resume text using Gemini Pro."""
    result = await resume_analyzer.fix_resume_ats(resume_text, failed_checks)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/match")
async def match_jd(resume_text: str, jd_text: str):
    """Match resume text against a job description."""
    result = await resume_analyzer.match_resume_to_jd(resume_text, jd_text)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/improve")
async def improve_bullets(bullets: List[str]):
    """Improve resume bullet points."""
    result = await resume_analyzer.improve_content(bullets)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/extract")
async def extract_resume(file: UploadFile = File(...)):
    """Upload and extract structured data from resume."""
    temp_dir = Path(settings.storage_dir) / "temp_resumes"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = temp_dir / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        result = await resume_analyzer.extract_resume_data(file_path)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    finally:
        if file_path.exists():
            os.remove(file_path)
