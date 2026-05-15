"""
Tayyar Pipeline API — FastAPI entrypoint.

Pipeline 1: session + Daily room + Pipecat bot hook + MediaPipe metrics ingest.
Pipeline 2: finalize uploads → background analysis → scorecard poll.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import get_settings
from personas import get_persona_for_round
from pipelines import interview_pipeline as pipe
from pipelines import gemini_live
from routers import ai_interviewers, interview_ws, resume, question_bank, linkedin, salary, admin_prompt_catalog
from scorecard import scorecard_generator
from services import recording as rec
from services import session_context as session_ctx
from services import session_manager as sm
from services import usage_tracker

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

settings = get_settings()
app = FastAPI(title=settings.app_name)


def _cors_origins_list() -> list[str]:
    raw = (settings.cors_origins or "").strip()
    if not raw:
        return []
    return [o.strip() for o in raw.split(",") if o.strip()]


_cors = _cors_origins_list()
if settings.environment == "production" and not _cors:
    log.warning("CORS_ORIGINS is empty in production — browsers may block API calls.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors if _cors else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview_ws.router)
app.include_router(ai_interviewers.router, prefix=settings.api_prefix)
app.include_router(resume.router, prefix=settings.api_prefix)
app.include_router(question_bank.router, prefix=settings.api_prefix)
app.include_router(linkedin.router, prefix=settings.api_prefix)
app.include_router(salary.router, prefix=settings.api_prefix)
app.include_router(admin_prompt_catalog.router, prefix=settings.api_prefix)


def _load_question_bank(company: str) -> dict[str, Any]:
    safe = "".join(c for c in company.lower() if c.isalnum()) or "tcs"
    path = Path(__file__).parent / "question_banks" / f"{safe}.json"
    if not path.exists():
        path = Path(__file__).parent / "question_banks" / "tcs.json"
    fallback = Path(__file__).parent / "question_banks" / "tcs.json"
    for p in (path, fallback):
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            log.warning("question bank read failed %s: %s", p, e)
    return {"company": "Generic", "rounds": {}}


# ── Round label mapping ──
_ROUND_LABELS = {
    "R1": "R1 — Technical",
    "R2": "R2 — Case Study",
    "R3": "R3 — Behavioral",
    "R4": "R4 — Analytical",
    "R5": "R5 — HR",
    "BONUS": "Bonus — Rapid Fire",
}

_ROUND_TOPICS = {
    "R1": "Technical", "R2": "Product Case", "R3": "Behavioral",
    "R4": "Analytical", "R5": "HR", "BONUS": "Technical",
}

_ROUND_DIFF = {
    "R1": "Med", "R2": "Hard", "R3": "Med",
    "R4": "Hard", "R5": "Easy", "BONUS": "Easy",
}


@app.get(f"{settings.api_prefix}/question-bank")
def get_question_bank():
    """Return all questions from every JSON file in question_banks/."""
    bank_dir = Path(__file__).parent / "question_banks"
    questions: list[dict] = []
    for fp in sorted(bank_dir.glob("*.json")):
        try:
            data = json.loads(fp.read_text(encoding="utf-8"))
        except Exception:
            continue
        company = data.get("company", fp.stem)
        role = data.get("role", "General")
        industry = data.get("industry", "")
        rounds = data.get("rounds", {})
        for rcode, qs in rounds.items():
            label = _ROUND_LABELS.get(rcode, f"{rcode}")
            topic = _ROUND_TOPICS.get(rcode, "General")
            diff = _ROUND_DIFF.get(rcode, "Med")
            for q in qs:
                questions.append({
                    "q": q,
                    "company": company,
                    "role": role,
                    "industry": industry,
                    "round": label,
                    "topic": topic,
                    "diff": diff,
                    "year": "2026",
                    "asked": "",
                })
    return {"total": len(questions), "questions": questions}


async def _daily_create_room(name: str) -> tuple[str | None, str | None]:
    if not settings.daily_api_key:
        return None, None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                "https://api.daily.co/v1/rooms",
                headers={"Authorization": f"Bearer {settings.daily_api_key}", "Content-Type": "application/json"},
                json={"name": name[:48], "properties": {"enable_screenshare": False, "start_video_off": True}},
            )
            r.raise_for_status()
            data = r.json()
            url = data.get("url")
            # Meeting token for owner — simplified; production should mint per-participant tokens
            tr = await client.post(
                "https://api.daily.co/v1/meeting-tokens",
                headers={"Authorization": f"Bearer {settings.daily_api_key}", "Content-Type": "application/json"},
                json={"properties": {"room_name": data.get("name"), "is_owner": True}},
            )
            tr.raise_for_status()
            tok = tr.json().get("token")
            return url, tok
    except Exception as e:
        log.warning("Daily room creation failed: %s", e)
        return None, None


class CreateSessionBody(BaseModel):
    company: str = "TCS"
    role: str = "SDE"
    round_code: str = Field(default="R2")
    language: str = "English"
    voice_id: str | None = None
    gender: str = "female"
    difficulty: str = "medium"
    company_tier: str | None = None
    candidate_name: str | None = None
    candidate_profile: dict[str, Any] | None = None
    persona_base_id: str | None = None
    persona_prompt_append: str | None = None
    voice_name: str | None = None
    live_voice_name: str | None = None
    ai_interviewer_id: str | None = None
    session_briefing: str | None = None
    session_context: dict[str, Any] | None = None
    experience_level: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "pipecat_enabled": settings.pipecat_enabled}


@app.post(f"{settings.api_prefix}/sessions")
async def create_session(body: CreateSessionBody, background_tasks: BackgroundTasks):
    bank = _load_question_bank(body.company)
    persona = get_persona_for_round(
        body.round_code,
        gender=body.gender,
        difficulty=body.difficulty,
        company_tier=body.company_tier,
        persona_base_id=body.persona_base_id,
        persona_prompt_append=body.persona_prompt_append,
    )
    rounds_raw = bank.get("rounds")
    if not isinstance(rounds_raw, dict):
        rounds_raw = {}
    qs = rounds_raw.get(body.round_code)
    if not isinstance(qs, list):
        qs = []
    bank_text = json.dumps(qs[:6])

    cname = (body.candidate_name or "").strip() or "Candidate"

    sid = sm.new_session_id()

    system = session_ctx.build_system_prompt_from_context(
        session_briefing=body.session_briefing,
        base_persona=persona["system_prompt"],
        company=bank.get("company", body.company),
        role=body.role,
        round_code=body.round_code,
        language=body.language,
        question_bank_hint=bank_text,
        candidate_name=cname,
        candidate_profile=body.candidate_profile,
    )
    if body.session_briefing:
        log.info("session %s using client-compiled briefing (%d chars)", sid, len(body.session_briefing))

    from services import ai_interviewer_catalog as aicat

    resolved_voice = aicat.resolve_voice_for_session(
        voice_name=body.voice_name,
        live_voice_name=body.live_voice_name,
        ai_interviewer_id=body.ai_interviewer_id,
        persona_gender=body.gender,
    )
    log.info(
        "session %s voice: resolved=%r live_voice_name=%r voice_name=%r ai_interviewer_id=%r",
        sid,
        resolved_voice,
        body.live_voice_name,
        body.voice_name,
        body.ai_interviewer_id,
    )

    profile = body.candidate_profile if isinstance(body.candidate_profile, dict) else {}
    raw_resume = str(profile.get("rawResumeText") or profile.get("rawText") or "").strip()
    ctx_applied = bool(body.session_briefing and body.session_briefing.strip())

    session = sm.InterviewSession(
        id=sid,
        company=body.company,
        role=body.role,
        round_code=body.round_code,
        language=body.language,
        voice_id=body.voice_id,
        persona_id=persona["id"],
        system_prompt=system,
        live_voice_name=resolved_voice,
        interviewer_gender=body.gender,
        daily_room_url=None,
        daily_token=None,
        context_applied=ctx_applied,
        briefing_chars=len(body.session_briefing) if ctx_applied else len(system),
        has_resume_text=bool(raw_resume),
    )
    sm.create_session(session)

    return {
        "session_id": sid,
        "ws_url": f"{settings.api_prefix}/interview/ws/{sid}",
        "persona_id": persona["id"],
        "persona_name": persona["name"],
        "persona_title": persona["title"],
        "persona_one_liner": persona["one_liner"],
        "gemini_voice": resolved_voice,
        "live_model": settings.gemini_live_model,
        "ai_interviewer_id": body.ai_interviewer_id,
        "context_applied": ctx_applied,
        "briefing_chars": session.briefing_chars,
        "has_resume_text": session.has_resume_text,
        "system_prompt_chars": len(system),
    }


async def _run_pipecat(sid: str, room_url: str, room_token: str | None, system: str, bank: str):
    await pipe.launch_interview_bot(sid, room_url=room_url, room_token=room_token or "", system_prompt=system, question_bank_hint=bank)


class TranscriptEvent(BaseModel):
    role: str
    text: str
    ts: int | None = None


@app.post(f"{settings.api_prefix}/sessions/{{session_id}}/transcript")
def append_transcript(session_id: str, ev: TranscriptEvent):
    s = sm.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    sm.append_transcript_event(
        session_id,
        {"role": ev.role, "text": ev.text, "ts": ev.ts},
    )
    return {"ok": True}


@app.post(f"{settings.api_prefix}/sessions/{{session_id}}/metrics-batch")
def metrics_batch(session_id: str, batch: dict[str, Any]):
    s = sm.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    sm.append_metrics_batch(session_id, batch)
    return {"ok": True}


@app.post(f"{settings.api_prefix}/sessions/{{session_id}}/finalize")
async def finalize_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    audio: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    transcript: UploadFile | None = File(None),
):
    s = sm.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")

    paths: dict[str, str | None] = {}
    if audio and audio.filename:
        raw = await audio.read()
        paths["audio"] = rec.write_bytes(session_id, "candidate_audio.webm", raw)
    if video and video.filename:
        raw = await video.read()
        paths["video"] = rec.write_bytes(session_id, "candidate_video.webm", raw)
    if transcript and transcript.filename:
        raw = await transcript.read()
        tpath = rec.write_bytes(session_id, "transcript.json", raw)
        paths["transcript"] = tpath
    else:
        paths["transcript"] = rec.write_transcript_json(session_id, s.transcript)

    if s.metrics_batches:
        paths["mediapipe_metrics"] = rec.write_metrics_log(session_id, s.metrics_batches)

    sm.set_recordings(session_id, paths)
    sm.set_status(session_id, sm.SessionStatus.ANALYZING)
    background_tasks.add_task(scorecard_generator.analyze_session_task, session_id)
    return {"ok": True, "status": "analyzing", "paths": paths}


@app.get(f"{settings.api_prefix}/sessions/{{session_id}}/scorecard")
def get_scorecard(session_id: str):
    s = sm.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    if s.status == sm.SessionStatus.READY and s.scorecard:
        return {"status": "ready", "result": s.scorecard}
    if s.status == sm.SessionStatus.FAILED:
        return {"status": "failed", "error": s.analysis_error}
    return {"status": "pending", "result": None}


@app.get(f"{settings.api_prefix}/usage")
def get_usage(limit: int = 100, category: str | None = None, session_id: str | None = None, log_type: str | None = None):
    logs = usage_tracker.get_logs(limit=limit, category=category, session_id=session_id, log_type=log_type)
    summary = usage_tracker.get_summary()
    return {"logs": logs, "summary": summary}


@app.get(f"{settings.api_prefix}/usage/summary")
def get_usage_summary():
    return usage_tracker.get_summary()


if __name__ == "__main__":
    import uvicorn

    reload = settings.environment != "production"
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=reload)
