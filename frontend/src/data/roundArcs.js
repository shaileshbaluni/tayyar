/**
 * Round structure arcs for session briefing (aligned with backend personas/round_structures.py).
 */

export const ROUND_ARCS = {
  R1: {
    code: "R1",
    title: "Technical Screening",
    duration: "30–45 min",
    arc: [
      "Phase 1 — SCAN (3–4 min): Brief intro; one 60-second background snapshot; no deep follow-ups.",
      "Phase 2 — SWEEP (10–12 min): One short question per topic area; keep pace; cut long answers politely.",
      "Phase 3 — DRILL (8–10 min): One weaker topic — 1–2 standalone harder questions, not chained 'why?' pings.",
      "Phase 4 — EXECUTE (8–10 min): One live practical problem; one hint max if stuck.",
      "Phase 5 — DEBRIEF (3–4 min): Candidate questions; close with thanks and next steps.",
    ],
    tone: "Professional, efficient, neutral — short acknowledgments only.",
  },
  R2: {
    code: "R2",
    title: "Technical Deep Dive",
    duration: "45–60 min",
    arc: [
      "Phase 1 — ANCHOR (5–7 min): Candidate picks a resume project; high-level system description.",
      "Phase 2 — EXCAVATE (12–15 min): Multiple standalone deep questions on that project (trade-offs, failures, scale).",
      "Phase 3 — DESIGN (12–15 min): Scoped system design or architecture challenge; candidate leads.",
      "Phase 4 — PRESSURE (5–7 min): Intellectual pushback on one earlier claim; one 'limit' honesty question.",
      "Phase 5 — REFLECT (3–5 min): What went best; candidate questions; warm peer-level close.",
    ],
    tone: "Curious, engaged, respectful — stretch without ambush.",
  },
  R3: {
    code: "R3",
    title: "Managerial / Behavioral",
    duration: "30–45 min",
    arc: [
      "Phase 1 — FRAME (3–4 min): Conversational opener; how teammates really see them.",
      "Phase 2 — SURFACE (12–15 min): Three STAR stories across different competencies.",
      "Phase 3 — DIG (8–10 min): Pressure-test one rehearsed story with separate specificity prompts.",
      "Phase 4 — STRESS TEST (5–7 min): Hypothetical workplace scenario — two standalone questions.",
      "Phase 5 — ALIGN (3–4 min): Values and manager-fit; candidate questions.",
    ],
    tone: "Warm surface, sharp underneath — real conversation that is still evaluation.",
  },
  R4: {
    code: "R4",
    title: "HR / Culture Fit",
    duration: "20–30 min",
    arc: [
      "Phase 1 — CONNECT (4–5 min): Casual rapport; human check-in.",
      "Phase 2 — DISCOVER (8–10 min): Career story, motivation, self-awareness.",
      "Phase 3 — FIT CHECK (7–8 min): Values and environment alignment.",
      "Phase 4 — TERMS (5–7 min): Compensation, notice, location — gather, do not negotiate.",
      "Phase 5 — HANDOVER (3–4 min): Next steps; warm close.",
    ],
    tone: "Human, warm, direct — conversational but observant for red flags.",
  },
  FULL: {
    code: "FULL",
    title: "Full Loop / Leadership",
    duration: "90–120 min",
    arc: [
      "Simulated multi-stakeholder loop: executive presence, strategy, org judgment.",
      "Big-picture questions; challenge vague vision; expect crisp synthesis.",
      "Close with clarity on next steps.",
    ],
    tone: "Executive, direct, minimal small talk.",
  },
  CUS: {
    code: "CUS",
    title: "Custom / Case",
    duration: "45–60 min",
    arc: [
      "Phase 1 — BRIEF: Present business case crisply; allow clarifying questions.",
      "Phase 2 — FRAME: Candidate structures approach before diving in.",
      "Phase 3 — ANALYSE: Deep dive with data; introduce one complication.",
      "Phase 4 — RECOMMEND: Clear recommendation and prioritization.",
      "Phase 5 — DEFEND: Challenge one element of the recommendation.",
    ],
    tone: "Analytical, neutral weight — respect clear thinking.",
  },
};

export function resolveRoundArc(roundCode) {
  return ROUND_ARCS[roundCode] || ROUND_ARCS.R2;
}
