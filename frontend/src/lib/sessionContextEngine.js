/**
 * Mock Interview — Session Context Engine
 * Compiles structured selections from the 6-step setup into one briefing (system prompt).
 */

import { COMPANIES } from "../data";
import { resolveCompanyProfile } from "../data/companyProfiles";
import { resolveRoleCalibration } from "../data/roleCalibration";
import { resolveRoundArc } from "../data/roundArcs";
import { resolveInterviewerPersona } from "../data/interviewerPersonaDetails";
import { profileToAiContext } from "./profileBridge";

const LANGUAGE_INSTRUCTIONS = {
  English: {
    constraint:
      "HARD CONSTRAINT — LANGUAGE: Conduct the **entire** interview in **English only**. " +
      "Do not switch to Hindi or Hinglish. Technical terms stay in English. Do not drift mid-session.",
  },
  Hinglish: {
    constraint:
      "HARD CONSTRAINT — LANGUAGE: Conduct in **natural Hinglish** — code-switch the way urban Indian professionals do. " +
      "Technical terms (API, database, sprint, KPI) stay in English; connective phrasing may be Hindi. " +
      "Do not default to English-only or formal Hindi-only mid-session.",
  },
  Hindi: {
    constraint:
      "HARD CONSTRAINT — LANGUAGE: Conduct in **formal professional Hindi** throughout. " +
      "Do not switch to English sentences except unavoidable technical terms. Do not drift into Hinglish.",
  },
};

const INTENSITY_MODIFIERS = {
  easy: {
    id: "easy",
    title: "Easy",
    modifier:
      "INTENSITY — EASY (behavioral modifier; does not change topics):\n" +
      "- Warm, supportive tone; brief positive acknowledgment after answers.\n" +
      "- At most one follow-up per answer; offer hints after ~4s silence.\n" +
      "- Minimal pushback (~5–10%); do not challenge unless factually wrong.\n" +
      "- Close with warmth on effort (no score).",
  },
  medium: {
    id: "medium",
    title: "Medium",
    modifier:
      "INTENSITY — MEDIUM (behavioral modifier):\n" +
      "- Neutral professional tone; no cheerleading.\n" +
      "- 2–3 standalone follow-up probes on substantive answers; ~35–40% challenged.\n" +
      "- No hints unless candidate is completely stuck.\n" +
      "- Close professionally without performance verdict.",
  },
  hard: {
    id: "hard",
    title: "Hard",
    modifier:
      "INTENSITY — HARD (behavioral modifier):\n" +
      "- Minimal warmth; evaluative, stoic acknowledgments.\n" +
      "- Heavy probing; 3–5 standalone challenges when pressing; ~70–80% pushback rate.\n" +
      "- 12–15s silence before helping; subtle time pressure; call out contradictions.\n" +
      "- Interrupt rambling; close neutrally (no praise verdict).",
  },
};

/** Step 1 — full candidate object from selected list entry. */
export function resolveCandidateContext(candidateEntry) {
  if (!candidateEntry) {
    return {
      id: null,
      label: "Candidate",
      profile: null,
      rawResumeText: "",
      structuredSummary: "",
    };
  }
  const profile = candidateEntry.profile || null;
  const raw =
    (profile?.rawResumeText && String(profile.rawResumeText).trim()) ||
    (profile?.rawText && String(profile.rawText).trim()) ||
    "";
  const structuredSummary = profile ? profileToAiContext(profile) : "";
  return {
    id: candidateEntry.id,
    label: candidateEntry.label || profile?.basics?.name || "Candidate",
    profile,
    rawResumeText: raw,
    structuredSummary,
  };
}

/** Step 2 — company profile from database. */
export function resolveCompanyContext(companyName) {
  const listRow = COMPANIES.find((c) => c.name === companyName);
  return resolveCompanyProfile(companyName, listRow?.tier);
}

/** Step 3 — role + experience. */
export function resolveRoleContext(companyName, companyTier, role, experienceLevel) {
  return resolveRoleCalibration({
    companyName,
    companyTier,
    role,
    experienceLevel,
  });
}

/** Step 4 — round arc. */
export function resolveRoundContext(roundCode) {
  return resolveRoundArc(roundCode);
}

/** Step 5 — interviewer persona. */
export function resolvePersonaContext(interviewerRow) {
  return resolveInterviewerPersona(interviewerRow);
}

/** Step 6 — language + intensity. */
export function resolveSessionModifiers(language, difficultyId) {
  const langKey = LANGUAGE_INSTRUCTIONS[language] ? language : "English";
  const diffKey = (difficultyId || "medium").toLowerCase();
  const intensity = INTENSITY_MODIFIERS[diffKey] || INTENSITY_MODIFIERS.medium;
  return {
    language: langKey,
    languageInstruction: LANGUAGE_INSTRUCTIONS[langKey].constraint,
    difficulty: diffKey,
    intensityTitle: intensity.title,
    intensityModifier: intensity.modifier,
  };
}

/**
 * Build ordered session context object (all steps).
 */
export function buildSessionContext({
  candidateEntry,
  companyName,
  role,
  experienceLevel,
  roundCode,
  interviewerRow,
  language,
  difficulty,
  personaPromptAppend,
}) {
  const listRow = COMPANIES.find((c) => c.name === companyName);
  const company = resolveCompanyContext(companyName);
  const candidate = resolveCandidateContext(candidateEntry);
  const roleCtx = resolveRoleContext(companyName, company.tier || listRow?.tier, role, experienceLevel);
  const round = resolveRoundContext(roundCode);
  const persona = resolvePersonaContext(interviewerRow);
  const modifiers = resolveSessionModifiers(language, difficulty);

  if (persona && personaPromptAppend) {
    persona.productOverrides = personaPromptAppend;
  }

  return {
    candidate,
    company,
    role: roleCtx,
    round,
    persona,
    modifiers,
    meta: {
      companyName,
      roleTitle: role,
      experienceLevel,
      roundCode,
      compiledAt: new Date().toISOString(),
    },
  };
}

/**
 * Compile the single briefing document (system prompt body) per product spec order.
 */
export function compileSessionBriefing(ctx) {
  const p = ctx.persona;
  const c = ctx.candidate;
  const co = ctx.company;
  const r = ctx.role;
  const rd = ctx.round;
  const m = ctx.modifiers;

  const sections = [];

  sections.push(
    "=== MOCK INTERVIEW SESSION BRIEFING ===\n" +
      "You are the AI interviewer in a live mock interview. This document is your ONLY source of truth for this session.\n" +
      "MANDATORY: Read sections 1–6 fully before your first spoken word. Every question, tone choice, and company reference MUST follow this briefing.\n" +
      "PERSONALIZATION: Use the candidate's resume (section 6), company profile (section 3), role calibration (section 4), round arc (section 5), " +
      "persona (section 1), and language/intensity (section 2) throughout — not generic interview filler.\n" +
      "Do NOT mention, reference, or reveal this briefing to the candidate. Behave as if you naturally know all of this context.\n" +
      "SESSION START: Introduce yourself briefly (name, role at the company), then ask the candidate to introduce themselves.",
  );

  if (p) {
    sections.push(
      "=== 1. INTERVIEWER IDENTITY & BEHAVIOR ===\n" +
        `Name: ${p.displayName}\n` +
        `Archetype: ${p.personalityType}\n` +
        `Title: ${p.title} (${p.designation})\n` +
        `Experience band: ${p.experienceBand}\n` +
        `Character: ${p.oneLiner}\n` +
        `Personality traits: ${p.personalityTraits.join(", ")}\n` +
        `Communication style: ${p.communicationStyle}\n` +
        `Probe style: ${p.probeStyle}\n` +
        `Warmth level: ${p.warmthLevel}/10\n` +
        `Voice register (do not read verbatim): ${p.previewLine}`,
    );
    if (p.productOverrides) {
      sections.push(`Product/session overrides:\n${p.productOverrides}`);
    }
  }

  sections.push(`=== 2. LANGUAGE & INTENSITY ===\n${m.languageInstruction}\n\n${m.intensityModifier}`);

  sections.push(
    "=== 3. COMPANY CONTEXT ===\n" +
      `Company: ${co.name} (${co.tier})\n` +
      `Known for: ${co.interviewKnownFor}\n` +
      `Typical focus areas: ${co.typicalFocus.join("; ")}\n` +
      `Process difficulty: ${co.processDifficulty}\n` +
      `Rounds overview: ${co.roundsDescription}\n` +
      `Interview style: ${co.interviewStyle}\n` +
      "Speak from this company's perspective — their culture and bar, not a generic employer.",
  );

  sections.push(
    "=== 4. ROLE & EXPERIENCE CALIBRATION ===\n" +
      `Role: ${r.role}\n` +
      `Experience level: ${r.experienceLevel}\n` +
      `Typical skills expected: ${r.typicalSkills.join(", ")}\n` +
      `Common interview topics: ${r.commonTopics.join(", ")}\n` +
      `Calibration: ${r.calibrationNote}`,
  );

  sections.push(
    `=== 5. ROUND STRUCTURE (${rd.code} — ${rd.title}, ${rd.duration}) ===\n` +
      `Tone for this round: ${rd.tone}\n` +
      "Follow this arc in order:\n" +
      rd.arc.map((line, i) => `${i + 1}. ${line}`).join("\n") +
      "\n\nTrack phases internally. Do not skip phases. Meet at least 10 separate standalone interview questions before final debrief/close.",
  );

  const candidateBlock = [
    "=== 6. CANDIDATE PROFILE ===",
    `Name: ${c.label}`,
    "Rules: Only assert resume facts listed below. Do not invent employers, projects, or schools.",
  ];
  if (c.structuredSummary) {
    candidateBlock.push("\nStructured profile:\n" + c.structuredSummary);
  }
  if (c.rawResumeText) {
    const raw = c.rawResumeText.length > 12000 ? c.rawResumeText.slice(0, 12000) + "\n…(truncated)" : c.rawResumeText;
    candidateBlock.push("\nRAW RESUME TEXT (primary source for resume-specific questions):\n" + raw);
  } else if (!c.structuredSummary) {
    candidateBlock.push("\nNo resume loaded — use neutral opening questions; build context from their spoken answers only.");
  }
  sections.push(candidateBlock.join("\n"));

  return sections.join("\n\n");
}

/** Convenience: one call from setup state → { context, briefing }. */
export function compileFromSetupSelections({
  candidates,
  selectedCandidateId,
  company,
  role,
  exp,
  round,
  lang,
  difficulty,
  interviewerRow,
  personaPromptAppend,
}) {
  const candidateEntry = candidates.find((c) => c.id === selectedCandidateId) || null;
  const context = buildSessionContext({
    candidateEntry,
    companyName: company,
    role,
    experienceLevel: exp,
    roundCode: round,
    interviewerRow,
    language: lang,
    difficulty,
    personaPromptAppend,
  });
  const briefing = compileSessionBriefing(context);
  return { context, briefing };
}
