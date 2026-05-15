/** Role + experience calibration for session briefing. */

const ROLE_SKILLS = {
  SDE: ["Data structures", "Algorithms", "OOP", "DBMS", "System design basics", "Debugging"],
  "SDE-1": ["DSA", "Core CS", "Projects", "Git", "Basic system design"],
  "SDE-2": ["DSA", "System design", "Ownership stories", "Code quality", "Mentoring juniors"],
  "QA Engineer": ["Testing strategy", "Automation", "SDLC", "Bug reporting", "API testing"],
  "Systems Engineer": ["OS concepts", "Networking", "Scripting", "Infra basics", "Troubleshooting"],
  "Data Engineer": ["SQL", "ETL", "Pipelines", "Spark/batch", "Data modeling"],
  "Product Manager": ["Product sense", "Metrics", "Prioritization", "Stakeholders", "Cases", "Roadmaps"],
  "Business Analyst": ["Requirements", "SQL", "Process mapping", "Stakeholder communication"],
  Designer: ["Portfolio critique", "UX process", "Visual craft", "Collaboration with PM/eng"],
  "Data Scientist": ["Statistics", "ML basics", "Experimentation", "Python", "Business impact"],
  Consultant: ["Cases", "Frameworks", "Structured communication", "Client scenarios"],
  Analyst: ["Excel", "Domain knowledge", "Attention to detail", "Reporting"],
  MT: ["Leadership potential", "General aptitude", "Values", "Rotational readiness"],
  default: ["Role fundamentals", "Problem solving", "Communication", "Resume depth"],
};

const ROLE_TOPICS = {
  SDE: ["Coding", "Projects", "CS fundamentals", "Light system design"],
  "Product Manager": ["Product cases", "Metrics", "Prioritization", "Execution stories", "Stakeholder conflict"],
  default: ["Background", "Technical or functional depth", "Behavioral", "Motivation"],
};

const EXP_CALIBRATION = {
  Fresher: "Expect textbook fundamentals, academic projects, and learning agility — not production war stories.",
  "0-2 yrs": "Early-career: shipped features, debugging, teamwork; limited architecture ownership.",
  "2-5 yrs": "Mid-level: end-to-end ownership, trade-offs, cross-team work; moderate system design depth.",
  "5-10 yrs": "Senior: architecture, mentoring, business impact, failure recovery; fewer trivia questions.",
  "10+ yrs": "Staff/lead: strategy, org influence, multi-year impact; executive brevity expected.",
};

export function resolveRoleCalibration({ companyName, companyTier, role, experienceLevel }) {
  const skills = ROLE_SKILLS[role] || ROLE_SKILLS.default;
  const topics = ROLE_TOPICS[role] || ROLE_TOPICS.default;
  const expNote = EXP_CALIBRATION[experienceLevel] || EXP_CALIBRATION["2-5 yrs"];

  const calibrationNote = [
    `Calibrate for ${experienceLevel || "unspecified experience"} candidate interviewing for ${role} at ${companyName}.`,
    expNote,
    companyTier === "Tier 1 IT"
      ? "Emphasize fundamentals, communication, and stability; less startup-style ambiguity."
      : companyTier === "Product"
        ? "Emphasize ownership, metrics, trade-offs, and depth on one or two systems."
        : companyTier === "BFSI"
          ? "Emphasize risk awareness, process, and long-term fit."
          : companyTier === "Consulting"
            ? "Emphasize structured thinking and client-ready synthesis."
            : "Match industry-appropriate formality and depth.",
  ].join(" ");

  return {
    role: role || "General",
    experienceLevel: experienceLevel || "2-5 yrs",
    typicalSkills: skills,
    commonTopics: topics,
    calibrationNote,
  };
}
