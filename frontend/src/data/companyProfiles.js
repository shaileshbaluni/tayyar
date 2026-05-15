/**
 * Company interview profiles — prerequisite for company-specific mock sessions.
 * Keys match COMPANIES[].name in data/index.jsx.
 */

export const COMPANY_PROFILES = {
  TCS: {
    name: "TCS",
    tier: "Tier 1 IT",
    interviewKnownFor:
      "Structured multi-round campus and lateral process; heavy on fundamentals, communication, and willingness to relocate.",
    typicalFocus: ["DSA basics", "DBMS/SQL", "OOP", "Projects from resume", "HR stability questions"],
    processDifficulty: "Moderate — breadth over extreme depth",
    roundsDescription:
      "Typically 3–4 rounds: aptitude/technical screening, technical panel, managerial, HR. Often includes a short coding or pseudo-code segment.",
    interviewStyle:
      "Formal, process-driven, panel-oriented. Interviewers expect clear, structured answers and respect for hierarchy. Less startup-casual banter.",
  },
  Infosys: {
    name: "Infosys",
    tier: "Tier 1 IT",
    interviewKnownFor: "Strong campus pipeline; Infosys-specific competency mapping and communication assessment.",
    typicalFocus: ["Programming fundamentals", "Puzzles", "Communication", "Domain basics", "Why Infosys"],
    processDifficulty: "Moderate",
    roundsDescription: "Online assessment → technical → HR, sometimes a pre-placement talk round.",
    interviewStyle:
      "Professional and checklist-driven. Values clarity, teamwork narratives, and long-term employability signals.",
  },
  Wipro: {
    name: "Wipro",
    tier: "Tier 1 IT",
    interviewKnownFor: "Role-fit and client-readiness screening; mix of technical and behavioral.",
    typicalFocus: ["Core CS", "Testing mindset", "Client communication", "Relocation", "Notice period"],
    processDifficulty: "Moderate",
    roundsDescription: "Usually 3 rounds: written/online, technical, HR.",
    interviewStyle: "Conservative IT services tone — polite, structured, less aggressive probing than product firms.",
  },
  Flipkart: {
    name: "Flipkart",
    tier: "Product",
    interviewKnownFor: "High bar on problem-solving, system thinking, and ownership stories.",
    typicalFocus: ["DSA", "System design", "Product sense (for PM)", "Scale and trade-offs", "STAR behavioral"],
    processDifficulty: "Hard — selective bar",
    roundsDescription: "4–5 rounds: coding, system design, hiring manager, cultural fit, sometimes bar-raiser style depth.",
    interviewStyle:
      "Fast-paced product company. Interviewers probe trade-offs, metrics, and real impact. Expect follow-ups on vague answers.",
  },
  Razorpay: {
    name: "Razorpay",
    tier: "Product",
    interviewKnownFor: "Fintech rigor, API/platform thinking, and high ownership for engineers.",
    typicalFocus: ["System design", "Payments domain curiosity", "Reliability", "Incident stories", "API design"],
    processDifficulty: "Hard",
    roundsDescription: "Technical deep dives, system design, culture, leadership for senior roles.",
    interviewStyle:
      "Direct, intellectually intense. Values precision on distributed systems, security awareness, and builder mindset.",
  },
  Swiggy: {
    name: "Swiggy",
    tier: "Product",
    interviewKnownFor: "Operational scale, marketplace dynamics, and execution under ambiguity.",
    typicalFocus: ["System design", "Analytics", "Prioritization", "Cross-functional stories", "Latency and reliability"],
    processDifficulty: "Medium–hard",
    roundsDescription: "Mix of technical, case/product, and managerial rounds depending on role.",
    interviewStyle: "Pragmatic and outcome-focused. Likes concrete examples from high-growth environments.",
  },
  Zerodha: {
    name: "Zerodha",
    tier: "Product",
    interviewKnownFor: "Small teams, high autonomy, strong product and engineering judgment.",
    typicalFocus: ["Depth on one system", "Simplicity", "Risk/compliance awareness (fintech)", "User empathy", "Craft"],
    processDifficulty: "Hard — few rounds but deep",
    roundsDescription: "Often 2–3 intensive conversations with senior engineers or product leaders.",
    interviewStyle:
      "Minimal bureaucracy, direct questions, skepticism of buzzwords. PM interviews blend product cases with user and business judgment.",
  },
  "HDFC Bank": {
    name: "HDFC Bank",
    tier: "BFSI",
    interviewKnownFor: "Stability, compliance mindset, and conservative risk posture.",
    typicalFocus: ["Domain basics", "Excel/analytics", "Regulatory awareness", "Customer handling", "Long-term commitment"],
    processDifficulty: "Medium",
    roundsDescription: "Aptitude, domain/functional, panel, HR with compensation and location alignment.",
    interviewStyle: "Formal BFSI register. Family, relocation, and tenure questions are common.",
  },
  Deloitte: {
    name: "Deloitte",
    tier: "Consulting",
    interviewKnownFor: "Case interviews, structured thinking, and client-ready communication.",
    typicalFocus: ["Cases", "Guesstimates", "Frameworks", "Stakeholder management", "Business judgment"],
    processDifficulty: "Hard",
    roundsDescription: "Case rounds, partner interviews, fit and values conversations.",
    interviewStyle: "Polished, framework-friendly but tests originality. Expect crisp synthesis at the end of cases.",
  },
  HUL: {
    name: "HUL",
    tier: "FMCG",
    interviewKnownFor: "Leadership potential, consumer insight, and values-based assessment.",
    typicalFocus: ["Situation judgment", "Marketing intuition", "Teamwork", "Ethics", "Why FMCG"],
    processDifficulty: "Hard",
    roundsDescription: "Multiple behavioral and business-simulation style rounds.",
    interviewStyle: "Warm but evaluative. Culture and values weigh heavily alongside intellect.",
  },
};

/** Resolve full company profile; falls back to generic Product-style profile. */
export function resolveCompanyProfile(companyName, listTier) {
  const key = (companyName || "").trim();
  if (COMPANY_PROFILES[key]) {
    return { ...COMPANY_PROFILES[key] };
  }
  const tier = listTier || "Product";
  return {
    name: key || "Company",
    tier,
    interviewKnownFor: `Interviews at ${key} follow a ${tier} hiring pattern typical for Indian employers in this sector.`,
    typicalFocus: ["Role fundamentals", "Resume depth", "Behavioral fit", "Motivation"],
    processDifficulty: "Medium",
    roundsDescription: "Multi-round process with technical and HR components.",
    interviewStyle:
      "Professional Indian corporate interview — structured questions, resume-led probes, and culture-fit checks.",
  };
}
