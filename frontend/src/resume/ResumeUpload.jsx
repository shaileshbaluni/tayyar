import React, { useRef, useState } from "react";
import mammoth from "mammoth";
import { pdfjsLib } from "./pdfjs-setup";
import { useResumeStore } from "./store";
import { createId } from "./schema";
import { Icon } from "../components/ui";

async function extractTextFromPdf(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let prev = null;
    for (const item of content.items) {
      if (prev && Math.abs(item.transform[5] - prev.transform[5]) > 2) {
        lines.push("\n");
      }
      lines.push(item.str);
      prev = item;
    }
    lines.push("\n\n");
  }
  return lines.join("");
}

async function extractTextFromDocx(file) {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

const SECTION_HEADERS = {
  summary: /^(summary|profile|about\s*me|objective|professional\s*summary)/i,
  experience: /^(experience|work\s*experience|employment|professional\s*experience|work\s*history)/i,
  education: /^(education|academic|qualifications?|academic\s*background)/i,
  skills: /^(skills|technical\s*skills|core\s*competencies|technologies|tech\s*stack)/i,
  projects: /^(projects|personal\s*projects|key\s*projects)/i,
  certifications: /^(certifications?|licenses?|credentials)/i,
  achievements: /^(achievements?|awards?|honors?|accomplishments?)/i,
  languages: /^(languages?|linguistic)/i,
  links: /^(links?|social|profiles?|connect)/i,
};

function detectSection(line) {
  const clean = line.replace(/[:\-–—|•#*]/g, "").trim();
  if (clean.length > 40 || clean.length < 3) return null;
  for (const [key, re] of Object.entries(SECTION_HEADERS)) {
    if (re.test(clean)) return key;
  }
  return null;
}

function extractContact(text) {
  const basics = { name: "", email: "", phone: "", location: "", website: "", headline: "", usePhoto: false, profileImage: "" };
  const emailRe = /[\w.+-]+@[\w.-]+\.\w{2,}/g;
  const phoneRe = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
  const urlRe = /https?:\/\/[^\s,)]+/g;
  const locationRe = /(?:^|\s)([\w\s]+,\s*(?:India|Delhi|Mumbai|Bangalore|Bengaluru|Hyderabad|Chennai|Pune|Kolkata|Noida|Gurugram|Gurgaon|Haryana|Karnataka|Maharashtra|Tamil Nadu|Telangana|UP|Uttarakhand|Kerala|Gujarat|Rajasthan|West Bengal|Bihar|MP|Madhya Pradesh|Andhra Pradesh|Odisha|Assam|Punjab|Jharkhand|Chhattisgarh|Goa))/i;

  const emails = text.match(emailRe) || [];
  if (emails[0]) basics.email = emails[0];

  const phones = text.match(phoneRe) || [];
  if (phones[0]) basics.phone = phones[0].trim();

  const urls = text.match(urlRe) || [];
  for (const u of urls) {
    if (/linkedin/i.test(u)) continue;
    if (/github/i.test(u)) continue;
    basics.website = u;
    break;
  }
  if (!basics.website && urls[0]) basics.website = urls[0];

  const locMatch = text.match(locationRe);
  if (locMatch) basics.location = locMatch[1].trim();

  return { basics, emails, urls };
}

function parseResumeText(text) {
  const allLines = text.split("\n");
  const data = {
    basics: { name: "", email: "", phone: "", location: "", website: "", headline: "", usePhoto: false, profileImage: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    achievements: [],
    languages: [],
    links: [],
  };

  const { basics, urls } = extractContact(text);
  Object.assign(data.basics, basics);

  const nonEmpty = allLines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length > 0) {
    let nameLine = nonEmpty[0];
    nameLine = nameLine.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "").trim();
    nameLine = nameLine.replace(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, "").trim();
    nameLine = nameLine.replace(/https?:\/\/[^\s]+/g, "").trim();
    nameLine = nameLine.replace(/\d{6}/g, "").trim();
    nameLine = nameLine.replace(/[,|•·]/g, " ").replace(/\s+/g, " ").trim();
    if (nameLine.length > 0 && nameLine.length < 50) {
      data.basics.name = nameLine;
    }
  }

  const sections = [];
  let currentSection = null;
  let currentLines = [];

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;

    const sec = detectSection(line);
    if (sec) {
      if (currentSection) {
        sections.push({ type: currentSection, lines: currentLines });
      }
      currentSection = sec;
      currentLines = [];
    } else if (currentSection) {
      currentLines.push(line);
    }
  }
  if (currentSection) {
    sections.push({ type: currentSection, lines: currentLines });
  }

  for (const sec of sections) {
    const joined = sec.lines.join("\n");
    switch (sec.type) {
      case "summary":
        data.summary = joined.substring(0, 600);
        break;
      case "experience":
        data.experience = parseExperienceBlock(sec.lines);
        break;
      case "education":
        data.education = parseEducationBlock(sec.lines);
        break;
      case "skills":
        data.skills = parseSkillsBlock(sec.lines);
        break;
      case "projects":
        data.projects = parseProjectsBlock(sec.lines);
        break;
      case "certifications":
        data.certifications = sec.lines.filter(Boolean).map((l) => ({
          id: createId(), title: l.replace(/^[\-•*]\s*/, ""), date: "", issuer: "", description: "",
        }));
        break;
      case "achievements":
        data.achievements = sec.lines.filter(Boolean).map((l) => ({
          id: createId(), title: l.replace(/^[\-•*]\s*/, ""), date: "", description: "",
        }));
        break;
      case "languages":
        data.languages = sec.lines.filter(Boolean).map((l) => ({
          id: createId(), language: l.replace(/^[\-•*]\s*/, "").split(/[,\-–(]/)[0].trim(), level: 3,
        }));
        break;
      case "links":
        for (const l of sec.lines) {
          const u = l.match(/https?:\/\/[^\s]+/);
          if (u) data.links.push({ id: createId(), network: "", url: u[0], username: "" });
        }
        break;
    }
  }

  for (const u of urls) {
    if (/linkedin/i.test(u) && !data.links.find((l) => /linkedin/i.test(l.url))) {
      data.links.push({ id: createId(), network: "LinkedIn", url: u, username: "" });
    }
    if (/github/i.test(u) && !data.links.find((l) => /github/i.test(l.url))) {
      data.links.push({ id: createId(), network: "GitHub", url: u, username: "" });
    }
  }

  if (!data.summary && sections.length === 0 && nonEmpty.length > 1) {
    data.summary = nonEmpty.slice(1, 5).join(" ").substring(0, 600);
  }

  return data;
}

/** Same PDF/DOCX → text → `parseResumeText` path as Resume Builder upload (no server / Gemini). */
export async function parseResumeFromUploadFile(file) {
  if (!file) throw new Error("No file selected.");
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File too large. Maximum 10 MB.");
  }
  const lower = file.name.toLowerCase();
  let text;
  if (lower.endsWith(".pdf")) {
    text = await extractTextFromPdf(file);
  } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    text = await extractTextFromDocx(file);
  } else {
    throw new Error("Unsupported format. Upload a PDF or DOCX file.");
  }
  if (!text || text.trim().length < 10) {
    throw new Error("Could not extract text. The file may be image-based — try a text-based PDF.");
  }
  const data = parseResumeText(text);
  return { ...data, rawResumeText: text.trim() };
}

const DATE_RE = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,.-]*\d{4}|\d{4}[\s-]\d{2}|\d{4})/gi;

function parseExperienceBlock(lines) {
  const items = [];
  let cur = null;
  for (const line of lines) {
    const clean = line.replace(/^[\-•*]\s*/, "");
    const dates = line.match(DATE_RE);
    const isBullet = /^[\-•*]\s/.test(line);
    const looksLikeTitle = !isBullet && clean.length < 80 && /[A-Z]/.test(clean[0] || "");

    if (looksLikeTitle && !isBullet && dates) {
      if (cur) items.push(cur);
      cur = {
        id: createId(), position: clean.replace(DATE_RE, "").replace(/[|–\-·,]+$/, "").trim(),
        company: "", location: "", startDate: dates[0] || "", endDate: dates[1] || "",
        current: /present|current|ongoing/i.test(line), description: "",
      };
    } else if (looksLikeTitle && !isBullet && cur && !cur.company) {
      cur.company = clean.split(/[,·|–-]/)[0].trim();
      const rest = clean.replace(cur.company, "").replace(/^[,·|\s-]+/, "").trim();
      if (rest) cur.location = rest;
    } else if (cur) {
      cur.description += (cur.description ? "\n" : "") + clean;
    } else {
      if (cur) cur.description += (cur.description ? "\n" : "") + clean;
    }
  }
  if (cur) items.push(cur);
  return items;
}

function parseEducationBlock(lines) {
  const items = [];
  let cur = null;
  for (const line of lines) {
    const clean = line.replace(/^[\-•*]\s*/, "");
    const dates = line.match(DATE_RE);
    const isBullet = /^[\-•*]\s/.test(line);
    const looksLikeTitle = !isBullet && clean.length < 100 && /[A-Z]/.test(clean[0] || "");

    if (looksLikeTitle && dates) {
      if (cur) items.push(cur);
      cur = {
        id: createId(), degree: clean.replace(DATE_RE, "").replace(/[|–\-·,]+$/, "").trim(),
        area: "", school: "", grade: "", startDate: dates[0] || "", endDate: dates[1] || "", description: "",
      };
    } else if (looksLikeTitle && cur && !cur.school) {
      cur.school = clean;
    } else if (cur) {
      const gradeMatch = clean.match(/(?:GPA|CGPA|Grade|Percentage|Score)[:\s]*([^\s,]+)/i);
      if (gradeMatch) cur.grade = gradeMatch[1];
      else cur.description += (cur.description ? "\n" : "") + clean;
    }
  }
  if (cur) items.push(cur);
  return items;
}

function parseSkillsBlock(lines) {
  const skills = [];
  const seen = new Set();
  for (const line of lines) {
    const clean = line.replace(/^[\-•*]\s*/, "");
    const parts = clean.split(/[,;|•·]/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const name = p.replace(/[:\-]\s*$/, "").trim();
      if (name.length > 1 && name.length < 40 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        skills.push({ id: createId(), name, level: 3, keywords: [] });
      }
    }
  }
  return skills;
}

function parseProjectsBlock(lines) {
  const items = [];
  let cur = null;
  for (const line of lines) {
    const clean = line.replace(/^[\-•*]\s*/, "");
    const isBullet = /^[\-•*]\s/.test(line);
    const urlMatch = clean.match(/https?:\/\/[^\s]+/);

    if (!isBullet && clean.length < 80 && /[A-Z]/.test(clean[0] || "")) {
      if (cur) items.push(cur);
      cur = {
        id: createId(), name: clean.replace(/https?:\/\/[^\s]+/, "").trim(),
        startDate: "", endDate: "", website: urlMatch ? urlMatch[0] : "", description: "",
      };
    } else if (cur) {
      if (urlMatch && !cur.website) cur.website = urlMatch[0];
      cur.description += (cur.description ? "\n" : "") + clean;
    }
  }
  if (cur) items.push(cur);
  return items;
}

export const ResumeUpload = ({ onClose, compact, variant, sidebarDock }) => {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const importResumeData = useResumeStore((s) => s.importResumeData);

  const handleFile = async (file) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum 10 MB.");
      return;
    }
    setError(null);
    setStatus("Reading resume…");
    try {
      const data = await parseResumeFromUploadFile(file);
      importResumeData(data);
      if (onClose) onClose();
    } catch (e) {
      setError(e.message || "Upload failed");
      setStatus(null);
    }
  };

  if (variant === "rail") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          className="btn btn-accent btn-sm"
          title="Import PDF or DOCX"
          onClick={() => fileRef.current?.click()}
          style={{ width: 36, height: 36, padding: 0, borderRadius: 10, justifyContent: "center" }}
        >
          <Icon name="upload" size={18} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {status && (
          <div style={{ fontSize: 9, textAlign: "center", color: "var(--accent)", maxWidth: 44, lineHeight: 1.2 }}>{status}</div>
        )}
        {error && (
          <div style={{ fontSize: 9, textAlign: "center", color: "#991B1B", maxWidth: 44, lineHeight: 1.2 }}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        style={{
          border: "2px dashed var(--line-2)",
          borderRadius: sidebarDock ? 8 : compact ? 8 : 10,
          padding: sidebarDock ? "7px 5px" : compact ? "10px 6px" : "20px 12px",
          textAlign: "center",
          cursor: "pointer",
          background: "var(--surface)",
        }}
      >
        <Icon name="upload" size={sidebarDock ? 16 : compact ? 18 : 22} style={{ color: "var(--ink-3)", marginBottom: sidebarDock ? 2 : 4 }} />
        <div style={{ fontSize: sidebarDock ? 10 : compact ? 11 : 12, fontWeight: 600 }}>Drop PDF / DOCX</div>
        <div className="muted" style={{ fontSize: sidebarDock ? 8.5 : compact ? 9.5 : 10.5, marginTop: sidebarDock ? 1 : 2 }}>or tap to browse</div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {status && (
        <div style={{ marginTop: 6, padding: "4px 8px", borderRadius: 6, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11 }}>
          {status}
        </div>
      )}
      {error && (
        <div style={{ marginTop: 6, padding: "4px 8px", borderRadius: 6, background: "#FEE2E2", color: "#991B1B", fontSize: 11 }}>
          {error}
        </div>
      )}
    </div>
  );
};
