"""
Builds the live prompt catalog from production code (read-only source of truth).
Used by Admin → Prompt Studio.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from personas import PERSONAS
from personas import (
    COMPANY_TYPE_ADJUSTMENTS,
    DIFFICULTY_PROMPT_SUFFIX,
    MICRO_BEHAVIORS,
    PROHIBITED_BEHAVIORS,
)
from personas.round_structures import ROUND_STRUCTURES
from pipelines import gemini_live
from pipelines.gemini_live import METRICS_FUNCTION
from services import session_context as session_ctx

FEATURE_CATEGORIES = [
    "Mock Interview Engine",
    "Answer Builder",
    "Resume ATS Optimizer",
    "Resume Builder",
    "LinkedIn Optimizer",
    "Salary Negotiation Simulator",
    "GD Simulator",
    "Feedback Generator",
    "Communication Analysis",
    "Recommendation Engine",
]


def _entry(
    id: str,
    feature: str,
    name: str,
    description: str,
    content: str,
    *,
    variables: list[str] | None = None,
    source_file: str = "",
    source_symbol: str = "",
    when_used: str = "",
    pipeline: str = "",
    depends_on: list[str] | None = None,
    tags: list[str] | None = None,
    composed_from: list[str] | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": id,
        "feature": feature,
        "name": name,
        "description": description,
        "content": content,
        "variables": variables or [],
        "version": 1,
        "status": "active",
        "readOnly": True,
        "syncedFromCode": True,
        "sourceFile": source_file,
        "sourceSymbol": source_symbol,
        "whenUsed": when_used,
        "pipeline": pipeline,
        "dependsOn": depends_on or [],
        "composedFrom": composed_from or [],
        "tags": tags or ["production", "live-sync"],
        "createdBy": "code-sync",
        "createdAt": now,
        "updatedAt": now,
        "usageCount": 0,
        "avgResponseTimeMs": 0,
        "successRate": 1.0,
        "lastExecutedAt": None,
        "versions": [
            {
                "id": f"{id}_v1",
                "version": 1,
                "content": content,
                "createdAt": now,
                "createdBy": "code-sync",
            }
        ],
        "abVariantOf": None,
    }


def _mock_interview_prompts() -> list[dict[str, Any]]:
    mi = "Mock Interview Engine"
    out: list[dict[str, Any]] = []

    out.append(
        _entry(
            "mi_ctx_compiled_briefing",
            mi,
            "Session Context Briefing (Steps 1–6) — compiled at Start",
            "Primary system prompt body for live interviews. Built on the frontend from setup selections, "
            "then wrapped with Live grounding on the server. Sent as Gemini Live systemInstruction.",
            (
                "Compiled at runtime by frontend/src/lib/sessionContextEngine.js → compileSessionBriefing().\n"
                "Sections (in order):\n"
                "  0. MOCK INTERVIEW SESSION BRIEFING header + mandatory read rules\n"
                "  1. Interviewer identity & behavior (persona card + personaDetails)\n"
                "  2. Language hard constraint + intensity behavioral modifier\n"
                "  3. Company profile (companyProfiles.js)\n"
                "  4. Role & experience calibration (roleCalibration.js)\n"
                "  5. Round phase arc (roundArcs.js)\n"
                "  6. Candidate profile + RAW RESUME TEXT\n\n"
                "POST /api/v1/sessions with session_briefing + session_context JSON."
            ),
            variables=[
                "candidate_name",
                "company",
                "role",
                "experience_level",
                "round_code",
                "language",
                "difficulty",
                "persona_display_name",
                "raw_resume_text",
            ],
            source_file="frontend/src/lib/sessionContextEngine.js",
            source_symbol="compileSessionBriefing",
            when_used="InterviewSetup → POST /api/v1/sessions (session_briefing) → session.system_prompt",
            pipeline="Mock Interview Live (Gemini Live API)",
            depends_on=[
                "mi_ctx_language_*",
                "mi_ctx_intensity_*",
                "mi_live_grounding",
                "mi_persona_*",
                "mi_round_*",
            ],
            tags=["session-context-engine", "primary"],
        )
    )

    out.append(
        _entry(
            "mi_live_grounding",
            mi,
            "Live Context Binding Preamble",
            "Prepended on the server when session_briefing is present. Binds the model to steps 1–6 for the whole call.",
            session_ctx.LIVE_GROUNDING_PREAMBLE.strip(),
            source_file="backend/services/session_context.py",
            source_symbol="LIVE_GROUNDING_PREAMBLE",
            when_used="wrap_session_briefing() before Gemini setup",
            pipeline="Mock Interview Live",
            composed_from=["mi_ctx_compiled_briefing"],
        )
    )

    out.append(
        _entry(
            "mi_distinct_question_quota",
            mi,
            "Distinct Question Minimum (10 questions)",
            "Global rule: at least 10 standalone interview questions before Phase 5 / debrief.",
            gemini_live.DISTINCT_QUESTION_QUOTA_RULE.strip(),
            source_file="backend/pipelines/gemini_live.py",
            source_symbol="DISTINCT_QUESTION_QUOTA_RULE",
            when_used="Appended to every live system prompt (briefing + legacy paths)",
            pipeline="Mock Interview Live",
        )
    )

    out.append(
        _entry(
            "mi_live_metrics_tool",
            mi,
            "update_interview_metrics (function declaration)",
            "Gemini Live tool schema — model calls every ~30s for body-language metrics.",
            (
                f"Function name: {METRICS_FUNCTION['name']}\n\n"
                f"Description: {METRICS_FUNCTION['description']}\n\n"
                f"Parameters schema:\n{METRICS_FUNCTION['parameters']}"
            ),
            source_file="backend/pipelines/gemini_live.py",
            source_symbol="METRICS_FUNCTION",
            when_used="Gemini Live setup tools[] + WS intercept in interview_ws.py",
            pipeline="Mock Interview Live",
        )
    )

    out.append(
        _entry(
            "mi_live_metrics_instructions",
            mi,
            "Real-Time Body Language Analysis (spoken rules)",
            "Tells the model how to use the metrics tool without mentioning metrics aloud.",
            gemini_live.build_live_metrics_block().strip(),
            source_file="backend/pipelines/gemini_live.py",
            source_symbol="build_live_metrics_block",
            when_used="Appended to live system prompt",
            pipeline="Mock Interview Live",
            depends_on=["mi_live_metrics_tool"],
        )
    )

    out.append(
        _entry(
            "mi_candidate_grounding",
            mi,
            "Candidate Knowledge Block (legacy path)",
            "Used when session_briefing is absent; formats candidate_profile dict for the model.",
            (
                "Rules from build_candidate_grounding_block() + format_candidate_facts() profile lines.\n"
                "When session_briefing is sent, section 6 of the briefing replaces this block."
            ),
            variables=["CANDIDATE_NAME", "candidate_profile"],
            source_file="backend/pipelines/gemini_live.py",
            source_symbol="build_candidate_grounding_block",
            when_used="build_live_system_prompt() fallback only",
            pipeline="Mock Interview Live (legacy)",
        )
    )

    for key, suffix in DIFFICULTY_PROMPT_SUFFIX.items():
        out.append(
            _entry(
                f"mi_difficulty_{key}",
                mi,
                f"Difficulty Modifier — {key.title()}",
                "Behavioral modifier for tone, follow-ups, silence, pushback (not question topics).",
                suffix.strip(),
                variables=["difficulty"],
                source_file="backend/personas/__init__.py",
                source_symbol=f"DIFFICULTY_PROMPT_SUFFIX['{key}']",
                when_used="get_persona_for_round() appends to persona system_prompt",
                pipeline="Mock Interview Live",
                tags=["intensity", key],
            )
        )

    out.append(
        _entry(
            "mi_micro_behaviors",
            mi,
            "Micro-Behaviors Fragment",
            "Optional verbal habits injected into composed persona prompt.",
            MICRO_BEHAVIORS.strip(),
            source_file="backend/personas/__init__.py",
            source_symbol="MICRO_BEHAVIORS",
            when_used="get_persona_for_round()",
            pipeline="Mock Interview Live",
        )
    )

    out.append(
        _entry(
            "mi_prohibited_behaviors",
            mi,
            "Prohibited Behaviors",
            "Hard guardrails — no AI reveal, no mid-interview scores.",
            PROHIBITED_BEHAVIORS.strip(),
            source_file="backend/personas/__init__.py",
            source_symbol="PROHIBITED_BEHAVIORS",
            when_used="get_persona_for_round()",
            pipeline="Mock Interview Live",
        )
    )

    for tier, text in COMPANY_TYPE_ADJUSTMENTS.items():
        safe = tier.lower().replace(" ", "_")
        out.append(
            _entry(
                f"mi_company_tier_{safe}",
                mi,
                f"Company Culture Adjustment — {tier}",
                "Appended when company_tier matches setup selection.",
                text.strip(),
                variables=["company_tier"],
                source_file="backend/personas/__init__.py",
                source_symbol="COMPANY_TYPE_ADJUSTMENTS",
                when_used="get_persona_for_round(company_tier=…)",
                pipeline="Mock Interview Live",
            )
        )

    for pid, persona in PERSONAS.items():
        tpl = persona.get("system_prompt_template", "")
        out.append(
            _entry(
                f"mi_persona_{pid}",
                mi,
                f"Persona Bible — {persona.get('id', pid)}",
                persona.get("one_liner", ""),
                tpl.strip(),
                variables=[
                    "name",
                    "title",
                    "experience",
                    "opening",
                    "ack_*",
                    "thinking_sound",
                    "…persona gender vars",
                ],
                source_file=f"backend/personas/{pid.replace('-', '_')}.py",
                source_symbol="PERSONA['system_prompt_template']",
                when_used="get_persona_for_round(persona_base_id) → merged into briefing section 1 or legacy prompt",
                pipeline="Mock Interview Live",
                tags=["persona-bible", pid],
            )
        )

    for rcode, structure in ROUND_STRUCTURES.items():
        out.append(
            _entry(
                f"mi_round_{rcode}",
                mi,
                f"Round Structure — {rcode}",
                "Five-phase arc the interviewer must follow in order.",
                structure.strip(),
                variables=["COMPANY", "ROLE", "CANDIDATE_NAME", "EXPERIENCE", "LANGUAGE"],
                source_file="backend/personas/round_structures.py",
                source_symbol=f"ROUND_STRUCTURES['{rcode}']",
                when_used="get_persona_for_round(round_code) + briefing section 5",
                pipeline="Mock Interview Live",
                tags=["round-arc", rcode],
            )
        )

    out.append(
        _entry(
            "mi_legacy_live_fallback",
            mi,
            "Legacy Live System Prompt Builder",
            "Used only when session_briefing is missing. Composes grounding + persona + delivery rules.",
            (
                "build_live_system_prompt() in gemini_live.py — concatenates:\n"
                "- build_candidate_grounding_block\n"
                "- formatted persona (COMPANY, ROLE, …)\n"
                "- DISTINCT_QUESTION_QUOTA_RULE\n"
                "- spoken delivery, phase tracking, closure phrase\n"
                "- question bank hint (optional)\n"
                "- build_live_metrics_block\n"
                "- calibration opening line"
            ),
            source_file="backend/pipelines/gemini_live.py",
            source_symbol="build_live_system_prompt",
            when_used="session_ctx.build_system_prompt_from_context fallback",
            pipeline="Mock Interview Live (legacy)",
        )
    )

    return out


def _answer_builder_prompts() -> list[dict[str, Any]]:
    from routers import question_bank as qb

    content = """You are an elite interview coach. Generate a personalized, "first-person" answer for the following interview question.
The candidate will use this exact answer to respond during an interview, so it must sound natural, professional, and confident.

Question:
{{question}}

Candidate Profile/Resume Data:
{{profile_json}}

Strategic Guidelines for the Response:
1. First-Person Perspective: Always write in the first person (e.g., "I led a team...", "My approach was...").
2. STAR Integration: Weave in a specific Situation, Task, Action, and Result from the candidate's actual projects or experience. Be specific with metrics if available in the profile.
3. Tailored Relevance: If the question is about a specific skill (e.g., React, Leadership), prioritize the most relevant project from their resume that demonstrates this.
4. Professional Authenticity: Match the candidate's experience level. If they are a fresher, emphasize learning agility and academic projects. If experienced, emphasize impact and technical depth.
5. Conversational Flow: The answer should be structured for verbal delivery—avoid overly complex sentences or academic jargon.
6. Conciseness: Aim for a response that takes 60-90 seconds to speak (roughly 150-250 words).

Output: Return ONLY the polished interview response text."""

    return [
        _entry(
            "ab_personalized_answer",
            "Answer Builder",
            "Personalized Interview Answer",
            "Generates first-person STAR-style answer from question + profile via Gemini 2.5 Pro.",
            content,
            variables=["question", "profile_json"],
            source_file="backend/routers/question_bank.py",
            source_symbol="get_personalized_answer",
            when_used="POST /api/v1/question-bank/answer",
            pipeline="Answer Builder",
        ),
    ]


def _resume_prompts() -> list[dict[str, Any]]:
    ra = "Resume ATS Optimizer"
    prompts = [
        _entry(
            "ats_15_point_check",
            ra,
            "ATS 15-Point Compatibility Check",
            "Scores resume text against 15 ATS checks (Indian tech market).",
            """You are an expert ATS (Applicant Tracking System) specialist for the Indian tech market.
Analyze the following resume text against 15 ATS compatibility checks.
Resume Text:
{{resume_text}}

(Return JSON: overall_score, checks[], summary)""",
            variables=["resume_text"],
            source_file="backend/analysis/resume_analyzer.py",
            source_symbol="analyze_resume_ats",
            when_used="POST resume ATS analyze",
            pipeline="Resume ATS",
        ),
        _entry(
            "ats_fix_resume",
            ra,
            "ATS Auto-Fix Resume Text",
            "Rewrites resume to pass failed ATS checks.",
            """You are an expert resume writer. Fix the following resume text to pass ATS filters.
Target fixes: {{failed_checks}}

Original Resume:
{{resume_text}}

Return ONLY the full updated resume text.""",
            variables=["resume_text", "failed_checks"],
            source_file="backend/analysis/resume_analyzer.py",
            source_symbol="fix_resume_ats",
            when_used="Resume ATS fix flow",
            pipeline="Resume ATS",
        ),
        _entry(
            "ats_jd_match",
            ra,
            "Resume ↔ JD Keyword Match",
            "Keyword matrix and optimization tips.",
            """Analyze the match between this resume and job description.
Resume: {{resume_text}}
Job Description: {{jd_text}}
(Return JSON: match_score, keyword_matrix, section_analysis, optimization_tips)""",
            variables=["resume_text", "jd_text"],
            source_file="backend/analysis/resume_analyzer.py",
            source_symbol="match_resume_to_jd",
            when_used="Resume ATS JD match",
            pipeline="Resume ATS",
        ),
        _entry(
            "ats_improve_bullets",
            ra,
            "Strengthen Resume Bullets",
            "Impact rewrites for bullet list.",
            """Improve these resume bullet points for a high-end Indian tech role (TCS, Google, Zomato).
Bullets: {{bullets_json}}
(Return JSON array: original, score, issue, improved)""",
            variables=["bullets_json"],
            source_file="backend/analysis/resume_analyzer.py",
            source_symbol="improve_content",
            when_used="Resume ATS bullet improve",
            pipeline="Resume ATS",
        ),
        _entry(
            "ats_extract_structured",
            ra,
            "Resume Parser (structured extract)",
            "Extracts education, experience, projects, certifications JSON from resume text.",
            """You are an expert resume parser. Extract education, experience, projects, certifications from:
{{resume_text}}
(Return JSON: basics, education, experience, projects, certifications)""",
            variables=["resume_text"],
            source_file="backend/analysis/resume_analyzer.py",
            source_symbol="extract_resume_data",
            when_used="Resume upload / onboarding extract",
            pipeline="Resume ATS / Builder",
        ),
    ]
    return prompts


def _linkedin_prompts() -> list[dict[str, Any]]:
    from analysis.linkedin_analyzer import SYSTEM_PROMPT

    li = "LinkedIn Optimizer"
    base = SYSTEM_PROMPT.strip()
    return [
        _entry(
            "li_system",
            li,
            "LinkedIn Expert System Prompt",
            "Shared tone/context for all LinkedIn Gemini calls.",
            base,
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="SYSTEM_PROMPT",
            when_used="Prefixed to every LinkedIn analyzer prompt",
            pipeline="LinkedIn Optimizer",
        ),
        _entry(
            "li_profile_audit",
            li,
            "Full Profile Audit (9 components)",
            "Scores headline, about, experience, skills, etc.",
            f"{base}\n\nAnalyze Profile Data:\n{{profile_json}}\n(Return JSON: overall_score, components[], summary)",
            variables=["profile_json"],
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="analyze_profile",
            when_used="LinkedIn profile analysis",
            pipeline="LinkedIn Optimizer",
            depends_on=["li_system"],
        ),
        _entry(
            "li_headlines",
            li,
            "Headline Generator (5 strategies)",
            "Recruiter-optimized + brand variants.",
            f"{base}\n\nGenerate 5 headline versions for {{current_role}} → {{target_role}}.",
            variables=["current_role", "target_role"],
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="generate_headlines",
            when_used="LinkedIn headline tool",
            pipeline="LinkedIn Optimizer",
            depends_on=["li_system"],
        ),
        _entry(
            "li_about",
            li,
            "About Section (3 versions)",
            "Storyteller / data-driven / career narrative.",
            f"{base}\n\nWrite 3 About versions from user_info JSON.",
            variables=["about_me", "achievements", "looking_for"],
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="generate_about_section",
            when_used="LinkedIn about generator",
            pipeline="LinkedIn Optimizer",
            depends_on=["li_system"],
        ),
        _entry(
            "li_experience_bullets",
            li,
            "Experience Bullet Improver",
            "Scores and rewrites experience bullets.",
            f"{base}\n\nImprove bullets for role at company.",
            variables=["position", "company", "summary"],
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="improve_experience",
            when_used="LinkedIn experience improve",
            pipeline="LinkedIn Optimizer",
            depends_on=["li_system"],
        ),
        _entry(
            "li_content_calendar",
            li,
            "30-Day Content Calendar",
            "Topics + sample drafts for LinkedIn posts.",
            f"{base}\n\n30-day calendar for {{role}} targeting {{target_companies}}.",
            variables=["role", "target_companies", "experience_level", "goal"],
            source_file="backend/analysis/linkedin_analyzer.py",
            source_symbol="generate_content_calendar",
            when_used="LinkedIn content calendar",
            pipeline="LinkedIn Optimizer",
            depends_on=["li_system"],
        ),
    ]


def _salary_prompts() -> list[dict[str, Any]]:
    sn = "Salary Negotiation Simulator"
    return [
        _entry(
            "sn_hr_negotiation",
            sn,
            "HR Negotiation Role-Play",
            "Live HR persona for salary negotiation by difficulty.",
            """You are an experienced HR Representative at {{company}}.
Negotiating {{role}} in {{city}}.
SCENARIO: {{scenario}} | DIFFICULTY: {{difficulty}}
USER CTC: {{current_ctc}} | OFFER: {{offered_ctc}} | TARGET: {{target_ctc}}

Personality by difficulty (Easy/Medium/Hard).
Return JSON: response, emotion, coach_tip.
History: {{history_json}}""",
            variables=[
                "company",
                "role",
                "city",
                "scenario",
                "difficulty",
                "current_ctc",
                "offered_ctc",
                "target_ctc",
                "history_json",
            ],
            source_file="backend/analysis/salary_negotiator.py",
            source_symbol="get_hr_response",
            when_used="Salary simulator live turns",
            pipeline="Salary Negotiation",
        ),
        _entry(
            "sn_scorecard",
            sn,
            "Negotiation Scorecard Analysis",
            "Post-session evaluation of negotiation performance.",
            """Analyze salary negotiation transcript.
CONFIG: {{config_json}} | TRANSCRIPT: {{transcript_json}}
Return JSON: overall_score, gain_lpa, parameters[], mistakes[], strengths[], final_verdict.""",
            variables=["config_json", "transcript_json"],
            source_file="backend/analysis/salary_negotiator.py",
            source_symbol="generate_scorecard",
            when_used="After salary simulation ends",
            pipeline="Salary Negotiation",
        ),
    ]


def _feedback_prompts() -> list[dict[str, Any]]:
    fg = "Feedback Generator"
    return [
        _entry(
            "fg_score_answer",
            fg,
            "Per-Question Scoring (post-interview)",
            "Scores one Q&A pair — technical accuracy, STAR, ideal answer.",
            """You are an expert technical interviewer scoring an Indian tech candidate's answer.

Question: {{question}}
Candidate's Answer: {{answer}}

Return ONLY valid JSON:
technical_accuracy, relevance, star_structure, depth, ai_feedback, ideal_answer, tags""",
            variables=["question", "answer"],
            source_file="backend/post_interview/llm_evaluator.py",
            source_symbol="score_answer_pair",
            when_used="Post-interview pipeline per Q&A",
            pipeline="Scorecard / Feedback",
        ),
        _entry(
            "fg_full_transcript",
            fg,
            "Full Transcript Analysis",
            "Parameter scores, verdict, key moments, tips.",
            """You are an expert technical interviewer evaluating a candidate for a {{role}} position.
Transcript: {{transcript_text}}

Return JSON: parameter_scores, verdict, key_moments[], tips[]""",
            variables=["role", "transcript_text"],
            source_file="backend/post_interview/llm_evaluator.py",
            source_symbol="analyze_full_transcript",
            when_used="Post-interview scorecard generation",
            pipeline="Scorecard / Feedback",
        ),
    ]


def build_live_prompt_catalog() -> dict[str, Any]:
    """Aggregate all prompts grouped by feature category."""
    by_cat: dict[str, list[dict[str, Any]]] = {c: [] for c in FEATURE_CATEGORIES}

    def add_all(items: list[dict[str, Any]]) -> None:
        for p in items:
            feat = p.get("feature", "Other")
            if feat not in by_cat:
                by_cat[feat] = []
            by_cat[feat].append(p)

    add_all(_mock_interview_prompts())
    add_all(_answer_builder_prompts())
    add_all(_resume_prompts())
    add_all(_linkedin_prompts())
    add_all(_salary_prompts())
    add_all(_feedback_prompts())

    # Placeholders for features not yet wired to Gemini prompts in repo
    by_cat.setdefault(
        "Resume Builder",
        [
            _entry(
                "rb_note",
                "Resume Builder",
                "Resume Builder (client-side)",
                "PDF/layout generation uses @react-pdf/renderer — no LLM system prompt in repo.",
                "Resume Builder exports structured profile data to PDF. AI prompts for section rewrite are shared with Resume ATS (ats_improve_bullets, ats_extract_structured).",
                source_file="frontend/src/resume/",
                when_used="Local render + optional ATS API",
                pipeline="Resume Builder",
                tags=["info"],
            )
        ],
    )
    by_cat.setdefault(
        "GD Simulator",
        [
            _entry(
                "gd_note",
                "GD Simulator",
                "GD Simulator (UI placeholder)",
                "Group Discussion uses FULL round structure in Mock Interview Engine when round_code=FULL.",
                "See mi_round_FULL in Mock Interview Engine. Dedicated GD UI may reuse mock interview stack.",
                source_file="backend/personas/round_structures.py",
                source_symbol="ROUND_STRUCTURES['FULL']",
                when_used="Round FULL mock interviews",
                pipeline="GD / Mock Interview",
                depends_on=["mi_round_FULL"],
            )
        ],
    )
    by_cat.setdefault(
        "Communication Analysis",
        [
            _entry(
                "ca_note",
                "Communication Analysis",
                "Live metrics + post-interview speech",
                "Real-time: Gemini function update_interview_metrics. Post: Whisper + speech_metrics pipeline.",
                "See mi_live_metrics_tool and post_interview/stage2_speech.py (no single text prompt — signal processing).",
                source_file="backend/post_interview/",
                when_used="During live interview + finalize",
                pipeline="Interview metrics",
                depends_on=["mi_live_metrics_tool"],
            )
        ],
    )
    by_cat.setdefault(
        "Recommendation Engine",
        [
            _entry(
                "re_note",
                "Recommendation Engine",
                "Recommendations (not LLM-prompted yet)",
                "Dashboard insights are rule-based / mock admin data — no production recommendation LLM prompt in repo.",
                "Future: usage vector → next best action prompt.",
                source_file="frontend/src/admin/mockAdminData.js",
                when_used="N/A",
                pipeline="Insights",
                tags=["planned"],
            )
        ],
    )

    total = sum(len(v) for v in by_cat.values())
    return {
        "categories": [c for c in FEATURE_CATEGORIES if by_cat.get(c)],
        "promptsByCategory": by_cat,
        "totalPrompts": total,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "live-code-sync",
    }
