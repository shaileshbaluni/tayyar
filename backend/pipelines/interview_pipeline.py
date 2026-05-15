"""
PIPELINE 1A — Pipecat voice interview bot (runs in Python alongside Daily WebRTC).

This pipeline uses the Gemini 3.1 Flash Live Preview model to handle end-to-end speech,
vision (camera input), and reasoning without requiring separate STT or TTS steps.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from config import get_settings

log = logging.getLogger(__name__)

PIPECTAT_IMPORT_ERROR: str | None = None
try:  # pragma: no cover
    from pipecat.pipeline.pipeline import Pipeline  # type: ignore
    from pipecat.pipeline.runner import PipelineRunner  # type: ignore
    from pipecat.pipeline.task import PipelineTask  # type: ignore
    from pipecat.services.google.gemini_live.llm import GeminiMultimodalLiveLLMService # type: ignore
    from pipecat.transports.services.daily import DailyParams, DailyTransport # type: ignore

    _PIPECAT_CORE = True
except Exception as e:  # pragma: no cover
    Pipeline = PipelineRunner = PipelineTask = GeminiMultimodalLiveLLMService = DailyParams = DailyTransport = None  # type: ignore
    _PIPECAT_CORE = False
    PIPECTAT_IMPORT_ERROR = str(e)


async def launch_interview_bot(
    session_id: str,
    *,
    room_url: str,
    room_token: str | None,
    system_prompt: str,
    question_bank_hint: str,
) -> None:
    """
    Entry point called from a background task after the browser client joins the Daily room.
    Constructs a Pipecat pipeline with Gemini Live.
    """
    settings = get_settings()
    if not settings.pipecat_enabled or not _PIPECAT_CORE:
        log.warning(
            "Pipecat bot not started for session %s (pipecat_enabled=%s, import_ok=%s): %s",
            session_id,
            settings.pipecat_enabled,
            _PIPECAT_CORE,
            PIPECTAT_IMPORT_ERROR or "ok",
        )
        return
        
    if not settings.gemini_api_key:
        log.error("Cannot launch Pipecat bot: GEMINI_API_KEY is not set.")
        return

    log.info("Launching Gemini Live Pipecat bot for session=%s room=%s", session_id, room_url)

    transport = DailyTransport(
        room_url=room_url,
        token=room_token or "",
        bot_name="Interviewer",
        params=DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_in_enabled=True,  # Forward candidate's video frames to Gemini
            camera_out_enabled=False,
            transcription_enabled=False, # Gemini handles this natively
            vad_enabled=True,
            vad_analyzer=None,
        )
    )

    # Note: gemini-3.1-flash-live-preview
    # We pass the system_prompt directly here.
    gemini_service = GeminiMultimodalLiveLLMService(
        api_key=settings.gemini_api_key,
        model="gemini-3.1-flash-live-preview",
        voice="Kore", # Professional voice
        modalities=["AUDIO"], # Output directly to audio
        system_instruction=system_prompt,
        temperature=0.7,
        start_audio_paused=False,
        start_video_paused=False,
    )
    
    # Configure latency settings per instructions
    # thinkingLevel is low to optimize for latency
    if hasattr(gemini_service, '_thinking_level'):
        gemini_service._thinking_level = "low"
    
    # In pipecat GeminiMultimodalLiveLLMService, typically arguments can be passed via kwargs or config
    # We'll set these dynamically if the class allows, or rely on standard Pipecat defaults
    
    pipeline = Pipeline([
        transport.input(),
        gemini_service,
        transport.output(),
    ])

    task = PipelineTask(pipeline, params={"session_id": session_id})
    runner = PipelineRunner()

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        transport.capture_participant_transcription(participant["id"])

    try:
        await runner.run(task)
    except Exception as e:
        log.exception("Error running Pipecat pipeline for session %s: %s", session_id, e)


def build_llm_system_prompt(
    base_persona: str, company: str, role: str, round_code: str, language: str = "English", question_bank_hint: str = "", resume_text: str = ""
) -> str:
    """Constructs the heavily structured system instruction for Gemini Live."""
    
    # Determine round-specific behavior
    round_behavior = ""
    if round_code == "R1":
        round_behavior = "Technical Screening: focus on foundational knowledge, brisk pace, breadth over depth."
    elif round_code == "R2":
        round_behavior = "Technical Deep Dive: system design, architecture decisions, deep drilling."
    elif round_code == "R3":
        round_behavior = "Behavioral: STAR-format questions, probe for individual contribution ('we' vs 'I')."
    elif round_code == "R4":
        round_behavior = "HR: cultural fit, career goals, salary expectations, conversational tone."
    else:
        round_behavior = "Full Loop: structured phases covering technical breadth, depth, behavioral, and HR topics."

    parts = [
        "### INTERVIEWER PERSONA",
        f"{base_persona}",
        f"You are conducting an interview for the {role} position at {company}.",
        
        "\n### ROUND SPECIFIC BEHAVIOR",
        f"Round Type: {round_code}",
        f"Behavior: {round_behavior}",
        
        "\n### ADAPTIVE DIFFICULTY & TIME MANAGEMENT",
        "- Track interview duration. Cover critical topics by 70% of time, start wrapping up at 85%, and close by the end.",
        "- If the candidate answers well, pick harder questions from the bank. If they struggle, maintain or decrease difficulty.",
        "- Never ask questions tagged for a higher experience level than the candidate's unless they are performing exceptionally well.",
        
        "\n### LANGUAGE INSTRUCTIONS",
        f"- The candidate's preferred language for this interview is: {language}.",
        "- For English, use professional Indian English. For Hinglish, use a natural mix with Hindi for conversational phrases and English for technical terms. For Hindi, use formal Hindi with technical terms in English.",
        
        "\n### CAMERA & VISION INSTRUCTIONS",
        "- You receive video frames of the candidate. Use visual observations (like body language, confusion, or nervousness) to adapt your behavior SUBTLY.",
        "- DO NOT verbalize your visual observations. Never say 'I can see you\\'re nervous'. Instead, silently observe and adapt (e.g., slow down, rephrase, provide hints).",
        
        "\n### RULES OF CONDUCT",
        "- Never break character as an interviewer.",
        "- Never say 'as an AI' or 'I am an AI'.",
        "- Never evaluate answers out loud during the interview (e.g., do not say 'Good answer!' or 'That is incorrect').",
        "- Do not provide the answer to a question just asked. Instead, ask follow-up questions.",
        "- Reference the candidate's resume and past projects.",
    ]
    
    if resume_text:
        parts.append("\n### CANDIDATE RESUME")
        parts.append(f"Use this to personalize questions:\n{resume_text}")

    if question_bank_hint:
        parts.append("\n### QUESTION BANK")
        parts.append("You have a bank of questions below. You do NOT need to ask all of them.")
        parts.append("Select 8-12 questions that are RELEVANT to the conversation so far. If the candidate mentions a project or technology, pivot to questions that explore that area.")
        parts.append("Your follow-up questions CAN be your own — they don't need to be from the bank. The bank is your starting knowledge, not a rigid script.")
        parts.append("Skip questions whose topics have already been covered.")
        parts.append(f"\n{question_bank_hint}")
        
    return "\n".join(parts)
