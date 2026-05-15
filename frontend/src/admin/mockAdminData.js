/** Mock data for embedded admin console (same shape as former admin-console mocks). */

export const MOCK_USERS = [
  {
    id: "u_1",
    name: "Shailesh Baluni",
    email: "shaileshbaluni04@gmail.com",
    plan: "pro",
    creditsUsed: 8420,
    creditsRemaining: 1580,
    mockInterviews: 47,
    resumesGenerated: 6,
    lastActive: "2026-05-14T08:12:00Z",
    status: "active",
  },
  {
    id: "u_2",
    name: "Priya Menon",
    email: "priya.menon@example.com",
    plan: "enterprise",
    creditsUsed: 42100,
    creditsRemaining: 7900,
    mockInterviews: 182,
    resumesGenerated: 22,
    lastActive: "2026-05-13T21:40:00Z",
    status: "active",
  },
  {
    id: "u_3",
    name: "Arjun Khanna",
    email: "arjun.k@example.com",
    plan: "free",
    creditsUsed: 320,
    creditsRemaining: 180,
    mockInterviews: 4,
    resumesGenerated: 1,
    lastActive: "2026-05-01T11:00:00Z",
    status: "paused",
  },
  {
    id: "u_4",
    name: "Meera Iyer",
    email: "meera.iyer@example.com",
    plan: "pro",
    creditsUsed: 12050,
    creditsRemaining: 950,
    mockInterviews: 63,
    resumesGenerated: 9,
    lastActive: "2026-05-14T02:05:00Z",
    status: "active",
  },
  {
    id: "u_5",
    name: "Rohan Das",
    email: "rohan.das@example.com",
    plan: "pro",
    creditsUsed: 9800,
    creditsRemaining: 200,
    mockInterviews: 38,
    resumesGenerated: 4,
    lastActive: "2026-04-28T09:30:00Z",
    status: "churned",
  },
];

function interviewBlock(userId) {
  const base = (suffix) => ({
    id: `${userId}_int_${suffix}`,
    company: suffix.includes("a") ? "TCS" : suffix.includes("b") ? "Amazon" : "Google",
    role: suffix.includes("a") ? "SDE" : "Backend Engineer",
    roundType: suffix.includes("1") ? "Technical R2" : "Behavioral",
    date: `2026-05-${10 + (suffix.charCodeAt(0) % 4)}T14:00:00Z`,
    durationMin: 28 + (suffix.length % 12),
    overallScore: 72 + (suffix.length % 20),
    communicationScore: 68 + (suffix.length % 22),
    technicalScore: 74 + (suffix.length % 18),
    confidenceScore: 70 + (suffix.length % 25),
    feedbackHighlights:
      "Strong structure on system design; tighten time-boxing on follow-ups.",
    strengths: ["Clear communication", "Good problem decomposition"],
    weaknesses: ["Occasional filler words", "Depth on edge cases"],
    aiSuggestions: ["Practice 2-minute concise summaries", "Add metrics to impact stories"],
  });
  return [base("a1"), base("b2"), base("c3"), base("d4"), base("e5")];
}

export function getUserDetail(userId) {
  const row = MOCK_USERS.find((u) => u.id === userId);
  if (!row) return null;
  return {
    user: row,
    signupDate: "2025-11-03T10:00:00Z",
    totalSessions: row.mockInterviews + row.resumesGenerated + 12,
    interview: {
      total: row.mockInterviews,
      avgScore: 76.4,
      highestScore: 91,
      lowestScore: 62,
      practiceHours: Math.round(row.mockInterviews * 0.42 * 10) / 10,
      weeklyActivity: [
        { week: "W14", count: 4 },
        { week: "W15", count: 7 },
        { week: "W16", count: 5 },
        { week: "W17", count: 9 },
        { week: "W18", count: 6 },
        { week: "W19", count: 8 },
      ],
      companyDistribution: [
        { company: "TCS", count: 14 },
        { company: "Amazon", count: 9 },
        { company: "Google", count: 6 },
        { company: "Infosys", count: 4 },
      ],
      roleDistribution: [
        { role: "SDE", count: 22 },
        { role: "Backend", count: 11 },
        { role: "Full Stack", count: 8 },
      ],
      scoreTrend: [
        { date: "May 01", score: 68 },
        { date: "May 04", score: 72 },
        { date: "May 07", score: 75 },
        { date: "May 10", score: 79 },
        { date: "May 13", score: 82 },
      ],
    },
    interviews: interviewBlock(userId),
    resume: {
      totalGenerated: row.resumesGenerated,
      atsOptimizations: Math.max(1, row.resumesGenerated - 1),
      downloads: row.resumesGenerated * 3,
      topTemplate: "Modern Minimal",
      scoreImprovement: [
        { month: "Feb", score: 62 },
        { month: "Mar", score: 68 },
        { month: "Apr", score: 74 },
        { month: "May", score: 81 },
      ],
    },
    platform: {
      dailyUsage: [
        { day: "Mon", minutes: 42 },
        { day: "Tue", minutes: 28 },
        { day: "Wed", minutes: 55 },
        { day: "Thu", minutes: 33 },
        { day: "Fri", minutes: 61 },
        { day: "Sat", minutes: 18 },
        { day: "Sun", minutes: 24 },
      ],
      weeklyActiveDays: 5,
      timeSpentHours: 38.2,
      featureHeatmap: [
        { feature: "Mock Interview", intensity: 0.92 },
        { feature: "Resume ATS", intensity: 0.55 },
        { feature: "Answer Builder", intensity: 0.41 },
        { feature: "Salary Sim", intensity: 0.22 },
      ],
      topFeature: "Mock Interview Engine",
      sessionFrequency: [
        { week: "W16", sessions: 9 },
        { week: "W17", sessions: 11 },
        { week: "W18", sessions: 8 },
        { week: "W19", sessions: 13 },
      ],
    },
    credits: {
      overTime: [
        { date: "May 05", used: 120 },
        { date: "May 07", used: 340 },
        { date: "May 09", used: 210 },
        { date: "May 11", used: 480 },
        { date: "May 13", used: 390 },
      ],
      byFeature: [
        { feature: "Live interview", credits: 5200 },
        { feature: "Resume AI", credits: 2100 },
        { feature: "Scoring", credits: 1120 },
      ],
      estimatedTokens: 4_200_000,
      mostExpensiveFeature: "Live interview",
      avgCreditsPerSession:
        Math.round((row.creditsUsed / Math.max(1, row.mockInterviews)) * 10) / 10,
    },
    insights: [
      "User practices behavioral interviews most frequently.",
      "Confidence score improved 28% in the last 30 days.",
      "Most targeted company: TCS.",
      "Peak activity between 7–10 PM local time.",
    ],
  };
}

const now = new Date().toISOString();

function makePrompt(id, feature, name, description, content, variables, overrides = {}) {
  return {
    id,
    feature,
    name,
    description,
    content,
    variables,
    version: 2,
    status: "active",
    createdBy: "admin@tayyar.io",
    createdAt: "2026-04-01T12:00:00Z",
    updatedAt: now,
    tags: ["production"],
    usageCount: 1200 + (id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 8000),
    avgResponseTimeMs: 800 + (id.length * 37) % 400,
    successRate: 0.94 + (id.length % 7) / 500,
    lastExecutedAt: now,
    versions: [
      {
        id: `${id}_v1`,
        version: 1,
        content,
        createdAt: "2026-04-01T12:00:00Z",
        createdBy: "system",
      },
    ],
    abVariantOf: null,
    dependsOn: [],
    ...overrides,
  };
}

export const FEATURE_CATEGORIES = [
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
];

export const SEED_PROMPTS_BY_CATEGORY = {
  "Mock Interview Engine": [
    makePrompt(
      "p_mi_1",
      "Mock Interview Engine",
      "Interviewer System Prompt",
      "Core persona + phase rules for live sessions.",
      "You are {{persona}} interviewing for {{company}} / {{role}}. Candidate: {{candidate_name}}.\n\nRules:\n- {{phase_rules}}\n- Language: {{language}}",
      ["persona", "company", "role", "candidate_name", "phase_rules", "language"]
    ),
    makePrompt(
      "p_mi_2",
      "Mock Interview Engine",
      "Question Bank Synthesizer",
      "Blends company bank with adaptive follow-ups.",
      "Given bank JSON:\n{{question_bank}}\nProduce the next question for round {{round}}.",
      ["question_bank", "round"]
    ),
  ],
  "Answer Builder": [
    makePrompt(
      "p_ab_1",
      "Answer Builder",
      "STAR Story Generator",
      "Expands bullet into STAR format.",
      "Context: {{role}} at {{company}}.\nBullet: {{bullet}}\nOutput STAR with metrics.",
      ["role", "company", "bullet"]
    ),
    makePrompt(
      "p_ab_2",
      "Answer Builder",
      "HR Answer Refiner",
      "Softens tone while keeping authenticity.",
      "Original:\n{{draft}}\nTone: {{tone}}",
      ["draft", "tone"]
    ),
    makePrompt(
      "p_ab_3",
      "Answer Builder",
      "Introduction Generator",
      "60-second professional intro.",
      "Profile summary:\n{{summary}}\nTarget role: {{role}}",
      ["summary", "role"]
    ),
    makePrompt(
      "p_ab_4",
      "Answer Builder",
      "Answer Evaluator",
      "Scores rubric alignment.",
      "Question: {{question}}\nAnswer: {{answer}}\nReturn JSON scores.",
      ["question", "answer"]
    ),
  ],
  "Resume ATS Optimizer": [
    makePrompt(
      "p_ats_1",
      "Resume ATS Optimizer",
      "JD Keyword Gap Analysis",
      "Maps JD to resume gaps.",
      "JD:\n{{jd}}\nResume text:\n{{resume}}",
      ["jd", "resume"]
    ),
  ],
  "Resume Builder": [
    makePrompt(
      "p_rb_1",
      "Resume Builder",
      "Section Rewriter",
      "Rewrites experience bullets for impact.",
      "Bullets:\n{{bullets}}\nIndustry: {{industry}}",
      ["bullets", "industry"]
    ),
  ],
  "LinkedIn Optimizer": [
    makePrompt(
      "p_li_1",
      "LinkedIn Optimizer",
      "Headline Optimizer",
      "SEO + credibility headline variants.",
      "Current: {{headline}}\nRoles: {{roles}}",
      ["headline", "roles"]
    ),
  ],
  "Salary Negotiation Simulator": [
    makePrompt(
      "p_sn_1",
      "Salary Negotiation Simulator",
      "Counter-Offer Script",
      "Role-play employer lines + candidate responses.",
      "Band: {{band}}\nLocation: {{location}}\nLevel: {{level}}",
      ["band", "location", "level"]
    ),
  ],
  "GD Simulator": [
    makePrompt(
      "p_gd_1",
      "GD Simulator",
      "Moderator Brief",
      "Sets topic + evaluation criteria.",
      "Topic: {{topic}}\nDuration: {{minutes}} min",
      ["topic", "minutes"]
    ),
  ],
  "Feedback Generator": [
    makePrompt(
      "p_fg_1",
      "Feedback Generator",
      "Post-Session Summary",
      "Structured feedback from transcript metrics.",
      "Transcript excerpt:\n{{transcript}}\nMetrics JSON:\n{{metrics}}",
      ["transcript", "metrics"]
    ),
  ],
  "Communication Analysis": [
    makePrompt(
      "p_ca_1",
      "Communication Analysis",
      "Filler Word Coach",
      "Lists patterns + replacements.",
      "Phrases:\n{{phrases}}",
      ["phrases"]
    ),
  ],
  "Recommendation Engine": [
    makePrompt(
      "p_re_1",
      "Recommendation Engine",
      "Next Best Action",
      "Recommends module from usage vector.",
      "Usage vector:\n{{usage_json}}",
      ["usage_json"]
    ),
  ],
};
