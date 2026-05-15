"""
WebSocket endpoint for real-time Gemini Live interview sessions.

The browser connects here; this proxy opens an upstream WebSocket to
Gemini Live API and relays audio/video bidirectionally. Function calls
(metrics) are intercepted, stored server-side, and forwarded to the browser.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import get_settings
from pipelines.gemini_live import GeminiLiveSession, resolve_session_voice
from services import session_manager as sm
from services import usage_tracker

log = logging.getLogger(__name__)
router = APIRouter()


def _extract_audio_parts(msg: dict) -> list[dict]:
    """Pull audio inline_data parts from a serverContent.modelTurn message."""
    parts = []
    sc = msg.get("serverContent") or msg.get("server_content") or {}
    mt = sc.get("modelTurn") or sc.get("model_turn") or {}
    for p in mt.get("parts", []):
        inline = p.get("inlineData") or p.get("inline_data") or {}
        mime = inline.get("mimeType") or inline.get("mime_type") or ""
        if not mime.startswith("audio/"):
            continue
        data = inline.get("data")
        if not data:
            continue
        parts.append({"data": data, "mimeType": mime})
    return parts


def _extract_text_parts(msg: dict) -> str:
    """Pull text from serverContent.modelTurn for transcript capture."""
    sc = msg.get("serverContent", {})
    mt = sc.get("modelTurn", {})
    texts = []
    for p in mt.get("parts", []):
        if "text" in p:
            texts.append(p["text"])
    return " ".join(texts)


def _extract_function_calls(msg: dict) -> list[dict]:
    """Pull function call objects from a toolCall message."""
    tc = msg.get("toolCall", {})
    return tc.get("functionCalls", [])


@router.websocket("/api/v1/interview/ws/{session_id}")
async def interview_ws(ws: WebSocket, session_id: str):
    session = sm.get_session(session_id)
    if not session:
        await ws.close(code=4004, reason="session not found")
        return

    await ws.accept()
    log.info(
        "Browser connected for session %s (context_applied=%s briefing_chars=%s system_prompt_chars=%s has_resume=%s)",
        session_id,
        getattr(session, "context_applied", False),
        getattr(session, "briefing_chars", 0),
        len(session.system_prompt or ""),
        getattr(session, "has_resume_text", False),
    )
    settings = get_settings()

    gemini = GeminiLiveSession()
    try:
        voice = resolve_session_voice(session)
        await gemini.connect(
            system_prompt=session.system_prompt,
            voice_name=voice,
        )
    except Exception as e:
        log.error("Failed to connect to Gemini Live: %s", e)
        usage_tracker.track_error(
            model=settings.gemini_live_model,
            purpose="Live interview connection failed",
            category="interview",
            error_message=str(e),
            error_type="connection_error",
            session_id=session_id,
            metadata={"company": session.company, "role": session.role, "round": session.round_code},
        )
        await ws.send_json({"type": "error", "message": str(e)})
        await ws.close()
        return

    await ws.send_json(
        {
            "type": "ready",
            "geminiVoice": voice,
            "liveModel": settings.gemini_live_model,
            "contextApplied": bool(getattr(session, "context_applied", False)),
            "briefingChars": getattr(session, "briefing_chars", 0),
            "hasResumeText": bool(getattr(session, "has_resume_text", False)),
        },
    )
    log.info(
        "Interview WS session %s upstream ready (voice=%s live_model=%s)",
        session_id,
        voice,
        settings.gemini_live_model,
    )
    sm.set_status(session_id, sm.SessionStatus.LIVE)
    session_start_ts = time.time()

    usage_tracker.track(
        model=settings.gemini_live_model,
        purpose="Live interview session started",
        category="interview",
        session_id=session_id,
        metadata={
            "company": session.company,
            "role": session.role,
            "round": session.round_code,
            "event": "session_start",
            "gemini_voice": voice,
        },
    )

    async def browser_to_gemini():
        """Relay audio/video from the browser to Gemini upstream."""
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                t = msg.get("type")
                if t == "audio":
                    await gemini.send_audio(msg["data"])
                elif t == "audio_stream_end":
                    await gemini.send_audio_stream_end()
                elif t == "turn_complete":
                    await gemini.send_client_turn_complete()
                elif t == "video":
                    await gemini.send_video(msg["data"])
                elif t == "end_session":
                    log.info("Client ended session %s", session_id)
                    break
        except WebSocketDisconnect:
            log.info("Browser disconnected from session %s", session_id)
        except Exception as e:
            log.warning("browser_to_gemini error: %s", e)

    async def gemini_to_browser():
        """Relay audio/metrics from Gemini to the browser."""
        model_text_buffer = ""
        try:
            while True:
                msg = await gemini.receive()
                if msg is None:
                    detail = gemini.close_reason or "upstream closed"
                    log.error(
                        "Gemini session ended for %s (%s). Check GEMINI_API_KEY and GEMINI_LIVE_MODEL in backend/.env",
                        session_id,
                        detail,
                    )
                    usage_tracker.track_error(
                        model=settings.gemini_live_model,
                        purpose="Live interview upstream disconnected",
                        category="interview",
                        error_message=detail,
                        error_type="upstream_closed",
                        session_id=session_id,
                    )
                    await ws.send_json({
                        "type": "error",
                        "message": (
                            "Gemini connection closed — ensure GEMINI_API_KEY is set in backend/.env, "
                            "GEMINI_LIVE_MODEL matches a current Live API model, then restart the backend. "
                            f"({detail})"
                        ),
                    })
                    break

                sc = msg.get("serverContent") or msg.get("server_content") or {}
                interrupted = bool(sc.get("interrupted"))
                if interrupted:
                    await ws.send_json({"type": "playback_clear"})

                # Same blob may still carry stale audio parts after an interrupt
                audio_parts = [] if interrupted else _extract_audio_parts(msg)
                for ap in audio_parts:
                    await ws.send_json({
                        "type": "audio",
                        "data": ap["data"],
                        "mimeType": ap["mimeType"],
                    })

                text = _extract_text_parts(msg)
                if text:
                    model_text_buffer += text

                if sc.get("turnComplete"):
                    await ws.send_json({"type": "turn_end"})
                    if model_text_buffer.strip():
                        sm.append_transcript_event(session_id, {
                            "role": "model",
                            "text": model_text_buffer.strip(),
                            "ts": int(time.time() * 1000),
                        })
                        await ws.send_json({
                            "type": "transcript",
                            "role": "model",
                            "text": model_text_buffer.strip(),
                        })
                    model_text_buffer = ""

                fn_calls = _extract_function_calls(msg)
                for fc in fn_calls:
                    if fc.get("name") == "update_interview_metrics":
                        metrics = fc.get("args", {})
                        metrics["timestamp"] = int(time.time() * 1000)
                        sm.append_metrics_batch(session_id, metrics)
                        await ws.send_json({
                            "type": "metrics",
                            "data": metrics,
                        })
                        await gemini.send_function_response(
                            fc.get("id", ""),
                            {"result": {"status": "recorded"}},
                        )

        except WebSocketDisconnect:
            pass
        except Exception as e:
            log.warning("gemini_to_browser error: %s", e)

    try:
        done, pending = await asyncio.wait(
            [
                asyncio.create_task(browser_to_gemini()),
                asyncio.create_task(gemini_to_browser()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    finally:
        duration_ms = int((time.time() - session_start_ts) * 1000)
        usage_tracker.track(
            model=settings.gemini_live_model,
            purpose="Live interview session ended",
            category="interview",
            session_id=session_id,
            duration_ms=duration_ms,
            is_audio=True,
            metadata={
                "company": session.company,
                "role": session.role,
                "round": session.round_code,
                "event": "session_end",
                "duration_sec": duration_ms // 1000,
            },
        )
        await gemini.close()
        try:
            await ws.close()
        except Exception:
            pass
        log.info("Session %s WebSocket closed", session_id)
