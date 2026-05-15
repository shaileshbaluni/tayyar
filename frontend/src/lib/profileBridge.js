import { createId } from "../resume/schema";

/**
 * Maps app profile shape (Profile.jsx / resume extract API) → Resume Builder `data` object.
 */
export function profileToResumeData(profile) {
  if (!profile || typeof profile !== "object") return {};

  const basics = {
    name: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    headline: "",
    ...(profile.basics && typeof profile.basics === "object" ? profile.basics : {}),
  };

  const experience = (Array.isArray(profile.experience) ? profile.experience : []).map((e) => {
    const highlights = Array.isArray(e.highlights) ? e.highlights : [];
    const desc = [e.summary, ...highlights].filter(Boolean).join("\n");
    const parts = String(e.date || "").split(/[–—-]/).map((s) => s.trim());
    return {
      id: createId(),
      company: e.company || "",
      position: e.position || "",
      location: "",
      startDate: parts[0] || "",
      endDate: parts[1] || "",
      current: /\b(present|current|now)\b/i.test(String(e.date || "")),
      description: desc,
    };
  });

  const education = (Array.isArray(profile.education) ? profile.education : []).map((ed) => ({
    id: createId(),
    school: ed.institution || ed.school || "",
    degree: ed.studyType || ed.degree || "",
    area: ed.area || "",
    grade: ed.score || ed.grade || "",
    startDate: "",
    endDate: ed.date || "",
    description: "",
  }));

  const projects = (Array.isArray(profile.projects) ? profile.projects : []).map((p) => {
    const highlights = Array.isArray(p.highlights) ? p.highlights : [];
    const desc = [p.description, ...highlights].filter(Boolean).join("\n");
    return {
      id: createId(),
      name: p.name || "",
      startDate: "",
      endDate: p.date || "",
      website: "",
      description: desc,
    };
  });

  const certifications = (Array.isArray(profile.certifications) ? profile.certifications : []).map((c) => ({
    id: createId(),
    title: c.name || c.title || "",
    date: c.date || "",
    issuer: c.issuer || "",
    description: "",
  }));

  return {
    basics,
    summary: typeof profile.summary === "string" ? profile.summary : "",
    experience,
    education,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    projects,
    certifications,
    achievements: Array.isArray(profile.achievements) ? profile.achievements : [],
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    links: Array.isArray(profile.links) ? profile.links : [],
    custom: Array.isArray(profile.custom) ? profile.custom : [],
  };
}

/**
 * Maps client-side `parseResumeText` output (Resume Builder / `parseResumeFromUploadFile`)
 * into the app profile shape used by onboarding and interview candidates.
 */
export function resumeParsedToProfile(parsed) {
  const empty = {
    basics: { name: "", email: "", phone: "", location: "" },
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    skills: [],
  };
  if (!parsed || typeof parsed !== "object") return empty;

  const b = parsed.basics && typeof parsed.basics === "object" ? parsed.basics : {};
  const basics = {
    name: String(b.name || "").trim(),
    email: String(b.email || "").trim(),
    phone: String(b.phone || "").trim(),
    location: String(b.location || "").trim(),
  };

  const experience = (Array.isArray(parsed.experience) ? parsed.experience : []).map((exp) => {
    const desc = String(exp.description || "").trim();
    const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
    const dateParts = [exp.startDate, exp.endDate].filter(Boolean);
    const dateStr =
      dateParts.length >= 2 ? `${exp.startDate || ""} – ${exp.endDate || ""}`.trim() : dateParts.join(" ").trim();
    return {
      company: String(exp.company || "").trim(),
      position: String(exp.position || "").trim(),
      date: dateStr,
      summary: lines[0] || desc.slice(0, 500) || "",
      highlights: lines.length > 1 ? lines.slice(1) : [],
    };
  });

  const education = (Array.isArray(parsed.education) ? parsed.education : []).map((ed) => ({
    institution: String(ed.school || "").trim(),
    area: String(ed.area || "").trim(),
    studyType: String(ed.degree || "").trim(),
    score: String(ed.grade || "").trim(),
    date: [ed.startDate, ed.endDate].filter(Boolean).join(" – ").trim() || String(ed.endDate || ed.startDate || "").trim(),
  }));

  const projects = (Array.isArray(parsed.projects) ? parsed.projects : []).map((p) => {
    const desc = String(p.description || "").trim();
    const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      name: String(p.name || "").trim(),
      date: String(p.endDate || p.startDate || "").trim(),
      description: lines[0] || desc || "",
      highlights: lines.length > 1 ? lines.slice(1) : [],
    };
  });

  const certifications = (Array.isArray(parsed.certifications) ? parsed.certifications : []).map((c) => ({
    name: String(c.title || c.name || "").trim(),
    issuer: String(c.issuer || "").trim(),
    date: String(c.date || "").trim(),
  }));

  const skills = (Array.isArray(parsed.skills) ? parsed.skills : [])
    .map((s) => {
      if (s && typeof s === "object" && String(s.name || "").trim()) {
        return {
          name: String(s.name).trim(),
          level: typeof s.level === "number" ? s.level : 3,
          keywords: Array.isArray(s.keywords) ? s.keywords : [],
        };
      }
      return null;
    })
    .filter(Boolean);

  const out = { basics, education, experience, projects, certifications, skills };
  const raw = String(parsed.rawResumeText || parsed.rawText || "").trim();
  if (raw) out.rawResumeText = raw;
  return out;
}

/** Compact text for LLM system prompt (server truncates if needed). */
export function profileToAiContext(profile) {
  if (!profile || typeof profile !== "object") return "";
  const lines = [];
  const b = profile.basics || {};
  if (b.name) lines.push(`Name: ${b.name}`);
  if (b.email) lines.push(`Email: ${b.email}`);
  if (b.phone) lines.push(`Phone: ${b.phone}`);
  if (b.location) lines.push(`Location: ${b.location}`);
  (profile.experience || []).slice(0, 6).forEach((e) => {
    lines.push(`Work: ${e.position || "?"} @ ${e.company || "?"} (${e.date || ""}) — ${(e.summary || "").slice(0, 220)}`);
  });
  (profile.education || []).slice(0, 4).forEach((ed) => {
    lines.push(`Education: ${ed.studyType || ""} ${ed.area || ""} @ ${ed.institution || ""} (${ed.date || ""})`);
  });
  (profile.projects || []).slice(0, 4).forEach((p) => {
    lines.push(`Project: ${p.name || ""} — ${(p.description || "").slice(0, 200)}`);
  });
  (profile.certifications || []).slice(0, 6).forEach((c) => {
    lines.push(`Cert: ${c.name || c.title || ""} (${c.issuer || ""}, ${c.date || ""})`);
  });
  return lines.join("\n");
}
