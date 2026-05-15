"""
Gemini Live API (Multimodal Live) WebSocket client.

Manages an upstream bidirectional WebSocket connection to Google's
BidiGenerateContent endpoint. Handles the setup handshake, audio/video
relay, and function-call interception for real-time metrics.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import websockets

from config import get_settings
from services.gemini_prebuilt_voices import normalize_voice_name, snap_voice_to_gender

log = logging.getLogger(__name__)

GEMINI_WS_BASE = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

METRICS_FUNCTION = {
    "name": "update_interview_metrics",
    "description": (
        "Report real-time interview performance metrics for the candidate. "
        "Call this every 30-60 seconds during the interview based on what you "
        "observe in the candidate's video feed and speech patterns."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "eye_contact_pct": {
                "type": "NUMBER",
                "description": "0-100, how much the candidate looks at the camera",
            },
            "posture": {
                "type": "STRING",
                "description": "good | slouching | leaning_back | tilted",
            },
            "expression": {
                "type": "STRING",
                "description": "neutral | smiling | tense | blank",
            },
            "smile_count_last_min": {
                "type": "INTEGER",
                "description": "Natural smiles observed in the last 60 seconds",
            },
            "fidget_level": {
                "type": "STRING",
                "description": "calm | moderate | fidgeting",
            },
            "self_touch_events_last_min": {
                "type": "INTEGER",
                "description": "Face/hair/neck touches in the last 60 seconds",
            },
            "speaking_pace_wpm": {
                "type": "INTEGER",
                "description": "Estimated words per minute",
            },
            "filler_count_last_min": {
                "type": "INTEGER",
                "description": "Filler words in the last 60 seconds",
            },
            "filler_total": {
                "type": "INTEGER",
                "description": "Cumulative filler words this session",
            },
            "multiple_faces_visible": {
                "type": "BOOLEAN",
                "description": "True if more than one distinct face is clearly visible in the candidate frame",
            },
            "non_candidate_speech_heard": {
                "type": "BOOLEAN",
                "description": "True if you clearly hear a second person coaching or speaking besides the candidate",
            },
            "coaching_tip": {
                "type": "STRING",
                "description": "One short tip if a significant issue is detected, else null",
            },
        },
        "required": [
            "eye_contact_pct",
            "posture",
            "expression",
            "fidget_level",
            "speaking_pace_wpm",
            "filler_count_last_min",
            "filler_total",
        ],
    },
}

VOICE_MAP = {
    "male-indian": "Orus",
    "female-indian": "Kore",
    "male-deep": "Charon",
    "female-bright": "Aoede",
}
DEFAULT_VOICE = "Kore"


def _canonical_live_model_id(model_id: str) -> str:
    """Gemini Live expects `models/<id>`; strip a duplicate `models/` prefix from env."""
    s = (model_id or "").strip()
    if s.startswith("models/"):
        s = s[len("models/") :].lstrip("/")
    return s or "gemini-3.1-flash-live-preview"


def _pick_voice(voice_id: str | None) -> str:
    if not voice_id:
        return normalize_voice_name(DEFAULT_VOICE)
    raw = VOICE_MAP.get(voice_id.lower().strip(), DEFAULT_VOICE)
    return normalize_voice_name(raw)


def build_gemini_live_setup_payload(model_id: str, system_prompt: str, voice_name: str) -> dict:
    """BidiGenerateContent `setup` object: AUDIO modality + speechConfig (language + prebuilt voice)."""
    mid = _canonical_live_model_id(model_id)
    vn = normalize_voice_name(voice_name, fallback=DEFAULT_VOICE)
    return {
        "setup": {
            "model": f"models/{mid}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    # languageCode aligns TTS with Indian English delivery in the system prompt; some Live stacks
                    # only bind prebuiltVoice when speech language is set explicitly.
                    "languageCode": "en-IN",
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": vn,
                        },
                    },
                },
            },
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "tools": [{"functionDeclarations": [METRICS_FUNCTION]}],
        }
    }


def resolve_session_voice(session: Any) -> str:
    """Prefer session.live_voice_name (already resolved at POST /sessions); else legacy voice_id map."""
    g = getattr(session, "interviewer_gender", None)
    raw = (getattr(session, "live_voice_name", None) or "").strip()
    if raw:
        # create_session runs ai_interviewer_catalog.resolve_voice_for_session; do not re-snap here.
        return normalize_voice_name(raw)
    base = _pick_voice(getattr(session, "voice_id", None))
    return snap_voice_to_gender(base, str(g) if g else None)


class GeminiLiveSession:
    """Manages one upstream WebSocket session to Gemini Live API."""

    def __init__(self) -> None:
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._closed = False
        self.close_reason: str | None = None

    async def connect(
        self,
        system_prompt: str,
        voice_name: str = DEFAULT_VOICE,
    ) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        url = f"{GEMINI_WS_BASE}?key={settings.gemini_api_key}"
        self._ws = await websockets.connect(url, max_size=16 * 1024 * 1024)

        vn = normalize_voice_name(voice_name, fallback=DEFAULT_VOICE)
        setup_msg = build_gemini_live_setup_payload(settings.gemini_live_model, system_prompt, vn)
        await self._ws.send(json.dumps(setup_msg))

        raw = await asyncio.wait_for(self._ws.recv(), timeout=15.0)
        try:
            resp = json.loads(raw)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Gemini setup: invalid JSON ({e!s}). First bytes: {raw[:200]!r}") from e

        err = resp.get("error")
        if err:
            msg = err.get("message", json.dumps(err)) if isinstance(err, dict) else str(err)
            raise RuntimeError(f"Gemini Live setup rejected: {msg}")

        if "setupComplete" not in resp:
            raise RuntimeError(
                "Gemini Live setup failed (no setupComplete). "
                f"Response snippet: {raw[:800]!r}. "
                "Set GEMINI_LIVE_MODEL in backend/.env to a current Live model id."
            )
        log.info(
            "Gemini Live session established (model=models/%s voice=%s)",
            _canonical_live_model_id(settings.gemini_live_model),
            vn,
        )

    async def send_audio(self, data_b64: str) -> None:
        if not self._ws or self._closed:
            return
        msg = {
            "realtimeInput": {
                "audio": {"mimeType": "audio/pcm;rate=16000", "data": data_b64}
            }
        }
        await self._ws.send(json.dumps(msg))

    async def send_audio_stream_end(self) -> None:
        """Tell Gemini the current user audio segment has ended (helps it take its turn)."""
        if not self._ws or self._closed:
            return
        await self._ws.send(json.dumps({"realtimeInput": {"audioStreamEnd": True}}))

    async def send_client_turn_complete(self) -> None:
        """Explicit end-of-user-turn so the model responds after silence."""
        if not self._ws or self._closed:
            return
        await self._ws.send(json.dumps({"clientContent": {"turnComplete": True}}))

    async def send_video(self, data_b64: str) -> None:
        if not self._ws or self._closed:
            return
        msg = {
            "realtimeInput": {
                "video": {"mimeType": "image/jpeg", "data": data_b64}
            }
        }
        await self._ws.send(json.dumps(msg))

    async def send_function_response(self, call_id: str, result: dict) -> None:
        if not self._ws or self._closed:
            return
        msg = {
            "toolResponse": {
                "functionResponses": [
                    {"id": call_id, "response": result}
                ]
            }
        }
        await self._ws.send(json.dumps(msg))

    async def receive(self) -> dict[str, Any] | None:
        """Yield the next message from Gemini. Returns None when closed."""
        if not self._ws or self._closed:
            return None
        try:
            raw = await self._ws.recv()
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode("utf-8", errors="replace")
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                snippet = raw[:200] if isinstance(raw, str) else repr(raw[:200])
                log.warning("Gemini non-JSON frame: %s", snippet)
                return {}
        except websockets.ConnectionClosed as e:
            self._closed = True
            self.close_reason = f"code={e.code} reason={e.reason or 'n/a'}"
            log.warning("Gemini upstream WebSocket closed: %s", self.close_reason)
            return None

    async def close(self) -> None:
        self._closed = True
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None


def format_candidate_facts(profile: dict[str, Any] | None) -> str:
    """Human-readable briefing lines from the session's candidate_profile dict."""
    if not profile or not isinstance(profile, dict):
        return ""
    lines: list[str] = []

    basics = profile.get("basics")
    if isinstance(basics, dict):
        for key, title in (
            ("name", "Name"),
            ("email", "Email"),
            ("phone", "Phone"),
            ("location", "Location"),
        ):
            val = str(basics.get(key) or "").strip()
            if val:
                lines.append(f"- {title}: {val}")

    summary = str(profile.get("summary") or "").strip()
    if summary:
        lines.append(f"- Summary: {summary[:800]}")

    for e in (profile.get("experience") or [])[:12]:
        if not isinstance(e, dict):
            continue
        pos = str(e.get("position") or "").strip()
        comp = str(e.get("company") or "").strip()
        dt = str(e.get("date") or "").strip()
        sm = str(e.get("summary") or "").strip()
        hls = e.get("highlights")
        extra = ""
        if isinstance(hls, list) and hls:
            extra = " " + " ".join(str(x).strip() for x in hls[:10] if str(x).strip())[:500]
        head = " | ".join(p for p in (pos, comp, dt) if p) or "(role unspecified)"
        chunk = head
        if sm:
            chunk += f" — {sm[:400]}"
        if extra:
            chunk += f" — {extra}"
        lines.append(f"- Experience: {chunk}")

    for ed in (profile.get("education") or [])[:8]:
        if not isinstance(ed, dict):
            continue
        inst = str(ed.get("institution") or ed.get("school") or "").strip()
        st = str(ed.get("studyType") or ed.get("degree") or "").strip()
        area = str(ed.get("area") or "").strip()
        dt = str(ed.get("date") or "").strip()
        chunk = " | ".join(p for p in (st, area, inst, dt) if p)
        if chunk:
            lines.append(f"- Education: {chunk}")

    for p in (profile.get("projects") or [])[:8]:
        if not isinstance(p, dict):
            continue
        nm = str(p.get("name") or "").strip()
        dt = str(p.get("date") or "").strip()
        desc = str(p.get("description") or "").strip()
        hls = p.get("highlights")
        extra = ""
        if isinstance(hls, list) and hls:
            extra = " " + " ".join(str(x).strip() for x in hls[:8] if str(x).strip())[:400]
        chunk = nm or "(project)"
        if dt:
            chunk += f" ({dt})"
        if desc:
            chunk += f" — {desc[:350]}"
        if extra:
            chunk += f" — {extra}"
        lines.append(f"- Project: {chunk}")

    for c in (profile.get("certifications") or [])[:10]:
        if not isinstance(c, dict):
            continue
        title = str(c.get("name") or c.get("title") or "").strip()
        issuer = str(c.get("issuer") or "").strip()
        dt = str(c.get("date") or "").strip()
        chunk = " | ".join(p for p in (title, issuer, dt) if p)
        if chunk:
            lines.append(f"- Certification: {chunk}")

    raw_resume = str(profile.get("rawResumeText") or profile.get("rawText") or "").strip()
    if raw_resume:
        snippet = raw_resume if len(raw_resume) <= 8000 else raw_resume[:8000] + "\n…(truncated)"
        lines.append(f"- Raw resume excerpt:\n{snippet}")

    skills = profile.get("skills")
    if isinstance(skills, list) and skills:
        names: list[str] = []
        for s in skills[:50]:
            if isinstance(s, dict) and str(s.get("name") or "").strip():
                names.append(str(s["name"]).strip())
            elif isinstance(s, str) and s.strip():
                names.append(s.strip())
        if names:
            lines.append("- Skills (keywords): " + ", ".join(names[:60]))

    return "\n".join(lines)


def build_candidate_grounding_block(candidate_name: str, facts: str) -> str:
    """Placed first in the system instruction so Live models attend to real profile data."""
    cn = (candidate_name or "").strip() or "Candidate"
    rules = (
        "=== CANDIDATE KNOWLEDGE (READ FIRST) ===\n"
        "You are the interviewer in a mock interview. This block is the only pre-session file you have about the candidate.\n"
        "STRICT RULES:\n"
        "1. You may ONLY assert facts (name, employers, schools, projects, certifications, skills) that appear in "
        "the CANDIDATE BRIEFING below. If the candidate asks what you know about them and a detail is not listed, "
        "say clearly that you do not have that in your briefing and invite them to answer from their own experience.\n"
        "2. Do not invent names, nicknames, employers, products, or projects. Do not use placeholders or joke names.\n"
        "3. If the briefing is empty, do not imply you read a resume. Ask neutral opening questions and rely on what "
        "they say in the conversation.\n"
        f"4. When addressing them by name, use «{cn}» unless it clearly conflicts with the Name line in the briefing.\n"
    )
    if facts.strip():
        body = facts.strip()
        if len(body) > 11000:
            body = body[:11000] + "\n…(truncated)"
        return rules + "\nCANDIDATE BRIEFING:\n" + body + "\n"
    return rules + "\nCANDIDATE BRIEFING: (empty — no structured profile was loaded for this session.)\n"


# Live interviews: minimum standalone prompts before Phase 5 (see build_live_system_prompt).
def build_live_metrics_block() -> str:
    """Real-time metrics function-call instructions (shared with session_context wrapper)."""
    return (
        "REAL-TIME BODY LANGUAGE ANALYSIS:\n"
        "You are receiving the candidate's webcam video at 1 FPS.\n"
        "Every 30-45 seconds, call the update_interview_metrics function with your assessment of:\n"
        "- eye_contact_pct: 0-100\n"
        "- posture: good | slouching | leaning_back | tilted\n"
        "- expression: neutral | smiling | tense | blank\n"
        "- smile_count_last_min: integer\n"
        "- fidget_level: calm | moderate | fidgeting\n"
        "- self_touch_events_last_min: integer\n"
        "- speaking_pace_wpm: integer\n"
        "- filler_count_last_min: integer\n"
        "- filler_total: integer (cumulative)\n"
        "- multiple_faces_visible: boolean (true if another person is clearly visible with the candidate)\n"
        "- non_candidate_speech_heard: boolean (true if someone other than the candidate is clearly speaking)\n"
        "- coaching_tip: string or null\n\n"
        "CRITICAL: Call `update_interview_metrics` every 30 seconds. This is vital for the dashboard.\n"
        "If you detect multiple faces or off-camera speech, set the booleans true and put a short neutral "
        "integrity warning in coaching_tip (no emojis).\n"
        "Do NOT mention metrics in your spoken responses.\n"
        "Do NOT change your behavior based on metrics."
    )


DISTINCT_QUESTION_QUOTA_RULE = (
    "DISTINCT QUESTION MINIMUM (mandatory; overrides conflicting lines elsewhere in this prompt, "
    "including phase scripts and difficulty modes):\n"
    "- Before you begin **Phase 5** (debrief, candidate's questions to you, or closing), you MUST have asked "
    "**at least 10 separate interview questions** in the substantive body of the interview (typically Phases 1–4).\n"
    "- **Separate question** = a **new** standalone interviewer prompt: a different topic, competency, scenario, "
    "trade-off, design angle, or behavioural prompt — **not** a continuation of the same question. "
    "Examples that do **not** count as new questions: \"Why?\", \"Elaborate\", \"Go deeper\", \"What else?\", "
    "\"And then?\", \"Can you unpack that?\" when they still target the **same** narrow point you just asked about.\n"
    "- You may use smooth verbal transitions (\"Alright — next I'd like to ask…\", \"Let's switch topics…\").\n"
    "- At most **one** brief clarifying sentence may follow a main question; if you still need more detail on that "
    "thread, ask again as a **fully reframed** standalone question.\n"
    "- Opening calibration small-talk (e.g. \"How are you doing?\") does **not** count toward the 10.\n"
    "- Track internally; **never** announce the count or numbering to the candidate.\n"
    "- **Group Discussion (FULL) rounds:** satisfy the minimum with **10 distinct prompts or challenges** "
    "(facilitator or simulated participants) that move the discussion — not rapid-fire continuations "
    "(\"why?\" \"why?\") on the same contribution.\n"
    "- Do **not** skip or shorten this requirement even if time is tight: prioritize meeting **10 separate questions** "
    "before Phase 5."
)


def build_live_system_prompt(
    base_persona: str,
    company: str,
    role: str,
    round_code: str,
    language: str,
    question_bank_hint: str = "",
    candidate_name: str = "Candidate",
    candidate_profile: dict[str, Any] | None = None,
) -> str:
    """Build the full system prompt for Gemini Live sessions."""
    cn = (candidate_name or "").strip() or "Candidate"
    facts = format_candidate_facts(candidate_profile)
    grounding = build_candidate_grounding_block(cn, facts)
    # Format the template with the provided variables.
    try:
        formatted_persona = base_persona.format(
            COMPANY=company,
            ROLE=role,
            EXPERIENCE="experienced",  # Can be derived from role or passed in
            LANGUAGE=language,
            CANDIDATE_NAME=cn,
        )
    except (KeyError, ValueError) as e:
        # Unmatched `{` in persona append / overrides also raises ValueError — do not fail session create.
        log.warning("system prompt .format skipped (%s); using unformatted persona block", e)
        formatted_persona = base_persona

    parts = [
        grounding,
        formatted_persona,
        DISTINCT_QUESTION_QUOTA_RULE,
        "SPOKEN DELIVERY (mandatory for audio output): Use clear Indian English with natural Indian professional "
        "rhythm and intonation. For Hinglish sessions, code-switch the way senior Indian interviewers do. "
        "Do not caricature; stay intelligible and professional.",
        f"Company context: interviewing for {company}, role {role}, round {round_code}.",
        f"Language preference: {language}. For Hinglish, code-switch naturally.",
        f"Address the candidate as «{cn}» when a name is appropriate (warm, professional).",
        "RAPID RESPONSE: If the candidate finishes speaking, you MUST respond immediately. Do not pause more than 1 second.",
        "PHASE TRACKING: You are strictly following the 5-phase structure defined above. Track which phase you are in internally. Do not repeat phases. "
        "Enter Phase 5 only after the DISTINCT QUESTION MINIMUM (10 separate questions) is satisfied.",
        f"CLOSURE: When you reach Phase 5, after answering the candidate's final questions, you MUST provide a final closing statement ending with the exact phrase: 'Thanks {cn}. We'll be in touch.' This signals the end of the interview.",
        "If the candidate asks to repeat, clarify, or says they did not hear you, "
        "respond helpfully with a concise restatement.",
    ]
    if question_bank_hint:
        parts.append(
            f"Draw from the company question bank where natural. Hint block:\n{question_bank_hint}"
        )
    parts.append(build_live_metrics_block())
    parts.append(
        "CALIBRATION: The first 10 seconds are a warm-up. Start with 'Hi, glad you could join today. How are you doing?'. "
        "Observe the baseline, then transition to Phase 1 of the interview."
    )
    return "\n\n".join(parts)
