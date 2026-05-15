export const COMPANIES = [
  { name:"TCS",        color:"#1F3D7A", tier:"Tier 1 IT", rounds:4, diff:"Easy",   offer:"42%" },
  { name:"Infosys",    color:"#2A6FBA", tier:"Tier 1 IT", rounds:4, diff:"Easy",   offer:"38%" },
  { name:"Wipro",      color:"#732D91", tier:"Tier 1 IT", rounds:3, diff:"Easy",   offer:"40%" },
  { name:"Flipkart",   color:"#E47B3B", tier:"Product",   rounds:5, diff:"Hard",   offer:"6%"  },
  { name:"Razorpay",   color:"#155E5C", tier:"Product",   rounds:5, diff:"Hard",   offer:"5%"  },
  { name:"Swiggy",     color:"#C2410C", tier:"Product",   rounds:4, diff:"Med",    offer:"8%"  },
  { name:"Zerodha",    color:"#2E5BFF", tier:"Product",   rounds:3, diff:"Hard",   offer:"3%"  },
  { name:"HDFC Bank",  color:"#B0271F", tier:"BFSI",      rounds:4, diff:"Med",    offer:"22%" },
  { name:"Deloitte",   color:"#3F7A56", tier:"Consulting",rounds:5, diff:"Hard",   offer:"12%" },
  { name:"HUL",        color:"#1A4FB0", tier:"FMCG",      rounds:5, diff:"Hard",   offer:"4%"  },
];

export const INTERVIEWER_PERSONAS = {
  R1: {
    id: "tech-screener", round: "Technical Screening",
    title: "Senior Software Engineer", exp: "5-8 yrs",
    male: "Vikram Desai", female: "Ananya Iyer",
    oneLiner: "Sharp, efficient, no-nonsense. Values precision.",
    color: "#3B82F6",
  },
  R2: {
    id: "tech-deep-dive", round: "Technical Deep Dive",
    title: "Principal Engineer / Architect", exp: "10-15 yrs",
    male: "Arjun Krishnamurthy", female: "Kavitha Nair",
    oneLiner: "Deeply curious, Socratic method, loves trade-offs.",
    color: "#8B5CF6",
  },
  R3: {
    id: "hiring-manager", round: "Managerial / Behavioral",
    title: "Engineering Manager", exp: "12-18 yrs",
    male: "Rajesh Mehta", female: "Sunita Sharma",
    oneLiner: "Strategic thinker, evaluates leadership + impact.",
    color: "#10B981",
  },
  R4: {
    id: "hr-representative", round: "HR / Culture Fit",
    title: "HR Business Partner", exp: "6-10 yrs",
    male: "Aditya Kapoor", female: "Meera Joshi",
    oneLiner: "Warm, empathetic, reads between the lines.",
    color: "#F59E0B",
  },
  FULL: {
    id: "department-head", round: "Leadership Assessment",
    title: "VP Engineering / SVP", exp: "18-25 yrs",
    male: "Sanjay Venkatesh", female: "Priya Raghavan",
    oneLiner: "Executive presence, big-picture, direct.",
    color: "#EF4444",
  },
  CUS: {
    id: "tech-deep-dive", round: "Custom",
    title: "Principal Engineer / Architect", exp: "10-15 yrs",
    male: "Arjun Krishnamurthy", female: "Kavitha Nair",
    oneLiner: "Deeply curious, Socratic method, loves trade-offs.",
    color: "#8B5CF6",
  },
};

export const ROLES = {
  "TCS": ["SDE", "QA Engineer", "Systems Engineer", "Data Engineer"],
  "Flipkart": ["SDE-1", "SDE-2", "Product Manager", "Business Analyst"],
  "Razorpay": ["SDE-1", "Product Manager", "Designer", "Data Scientist"],
  "default": ["SDE-1", "Business Analyst", "Product Manager", "Consultant"]
};

export const QUESTIONS = [
  { q:"Tell me about a time you had to make a decision with incomplete information.",
    company:"Flipkart", round:"R3 — Behavioral", role:"PM", topic:"Behavioral", diff:"Med", year:"2025", asked:"Asked 14×" },
  { q:"Design a URL shortener like bit.ly. Walk me through your approach.",
    company:"Razorpay", round:"R2 — System Design", role:"SDE-2", topic:"System Design", diff:"Hard", year:"2025", asked:"Asked 23×" },
  { q:"Why TCS, and what do you know about our Code Vita programme?",
    company:"TCS", round:"R1 — HR Screening", role:"SDE", topic:"Why-Company", diff:"Easy", year:"2026", asked:"Asked 51×" },
  { q:"Reverse a linked list iteratively, then explain time and space complexity.",
    company:"Infosys", round:"R1 — Technical", role:"SDE", topic:"DSA", diff:"Easy", year:"2026", asked:"Asked 67×" },
  { q:"How would you grow Swiggy Genie's daily orders by 30% in Tier-2 cities?",
    company:"Swiggy", round:"R3 — Product Case", role:"PM", topic:"Product Case", diff:"Hard", year:"2025", asked:"Asked 9×" },
  { q:"Walk me through a project from your resume where you owned the outcome end-to-end.",
    company:"HDFC Bank", round:"R2 — Manager", role:"Analyst", topic:"Behavioral", diff:"Med", year:"2025", asked:"Asked 18×" },
  { q:"Estimate the number of auto-rickshaws operating in Bengaluru on a Wednesday morning.",
    company:"Deloitte", round:"R2 — Case", role:"Consultant", topic:"Guesstimate", diff:"Hard", year:"2025", asked:"Asked 11×" },
  { q:"What does notice period buyout look like, and would you be open to relocating?",
    company:"HUL", round:"R4 — HR", role:"MT", topic:"HR", diff:"Easy", year:"2026", asked:"Asked 22×" },
];

export const PERSONA = {
  name: "Rahul Sharma",
  hi: "राहुल",
  email: "rahul@iitlucknow.ac.in",
  college: "B.Tech CSE, Tier-2 College, Lucknow",
  target: "TCS · Infosys · Wipro",
  streak: 12,
  xp: 2840,
  rank: "Top 18%",
  ready: 72,
  sessions: 17,
};

export const SCORE_PARAMS = [
  { k:"Communication Clarity", w:20, v:78, color:"var(--ink)" },
  { k:"Technical Accuracy",    w:25, v:65, color:"var(--accent)" },
  { k:"Confidence & Delivery", w:15, v:71, color:"var(--teal)" },
  { k:"Relevance & Structure", w:20, v:80, color:"var(--ink)" },
  { k:"Filler Words & Habits", w:10, v:54, color:"var(--gold)" },
  { k:"Body Language",         w:10, v:68, color:"var(--accent)" },
];

export const STAR_STORIES = [
  { name:"Leadership", status:"Done", q:"Tell me when you led a team", words:142 },
  { name:"Teamwork", status:"Practiced 2×", q:"Describe successful collaboration", words:128 },
  { name:"Conflict Resolution", status:"Draft", q:"How do you handle disagreements?", words:86 },
  { name:"Failure & Learning", status:"Empty", q:"Tell me about a time you failed", words:0 },
  { name:"Innovation", status:"Done", q:"When did you go above and beyond?", words:156 },
  { name:"Pressure / Deadlines", status:"Empty", q:"How do you handle tight deadlines?", words:0 },
  { name:"Problem Solving", status:"Draft", q:"Walk me through a complex problem", words:71 },
  { name:"Customer / User Focus", status:"Empty", q:"When did you prioritize user needs?", words:0 },
];

export const ATS_CHECKS = [
  { k:"File format (PDF, ATS-readable)", ok:true,  note:"PDF, text layer present" },
  { k:"Single-column layout",            ok:true,  note:"Detected 1 column" },
  { k:"Standard section headers",        ok:true,  note:"Education, Experience, Skills, Projects" },
  { k:"Contact info parseable",          ok:true,  note:"Phone + email + LinkedIn detected" },
  { k:"Date formats consistent",         ok:false, note:"Mixed: 'Jun 2024' and '06/2024' — pick one" },
  { k:"ATS-safe font",                   ok:true,  note:"Inter — readable" },
  { k:"No headers / footers",            ok:true,  note:"Clean" },
  { k:"No tables",                       ok:false, note:"Skills section uses a 2-col table — flatten" },
  { k:"No images / icons in text",       ok:true,  note:"Clean" },
  { k:"File size under 2 MB",            ok:true,  note:"187 KB" },
  { k:"Page count (1–2 pages)",          ok:true,  note:"1 page" },
  { k:"Bullet style consistent",         ok:true,  note:"All bullets •" },
  { k:"Special characters",              ok:false, note:"Found ☆ and ➜ — replace with text" },
  { k:"Keyword density vs JD",           ok:false, note:"6 of 12 critical keywords missing" },
  { k:"Quantified achievements",         ok:true,  note:"5 of 8 bullets have numbers" },
];

export const KEYWORDS_MISSING = ["Kubernetes","CI/CD","System Design","Microservices","Postgres","gRPC"];
export const KEYWORDS_HIT = ["React","Node.js","REST API","MongoDB","Docker","AWS"];

export const TRANSCRIPT = [
  { who:"AI", t:"Welcome Rahul. Let's start. Tell me a little about yourself — keep it under two minutes." },
  { who:"USER", t:"Sure, so I'm Rahul, currently in my final year of B.Tech CSE at a Tier-2 college in Lucknow." },
  { who:"USER", t:"Um, I've been building full-stack projects with React and Node, and I interned last summer at a fintech startup where I owned the payments dashboard." },
  { who:"AI", t:"That's interesting — what kind of payments dashboard? Walk me through the technical decisions." },
  { who:"USER", t:"Basically it was a, uh, real-time view of UPI settlements for merchants. We used WebSocket for live updates and Postgres with Redis caching for the historical view." },
  { who:"AI", t:"Good. Why Redis specifically and not just Postgres materialized views? What were the trade-offs?" },
];

export const GD_PARTICIPANTS = [
  { name:"You",       color:"var(--accent)", role:"You",            speaking:false },
  { name:"Aarav",     color:"#1F3D7A",       role:"Dominator",      speaking:true  },
  { name:"Priya",     color:"#732D91",       role:"Data Cruncher",  speaking:false },
  { name:"Ishaan",    color:"#155E5C",       role:"Devil's Advocate", speaking:false },
  { name:"Neha",      color:"#B68B3F",       role:"Agreeable",      speaking:false },
  { name:"Karthik",   color:"#3F7A56",       role:"Silent Thinker", speaking:false },
];
