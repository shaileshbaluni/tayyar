import { nanoid } from "nanoid";

export const createId = () => nanoid(10);

export const SECTION_TYPES = [
  "summary", "experience", "education", "skills",
  "projects", "certifications", "achievements",
  "languages", "links",
];

export const SECTION_LABELS = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  languages: "Languages",
  links: "Links / Socials",
};

export const SECTION_ICONS = {
  summary: "edit",
  experience: "work",
  education: "book",
  skills: "bolt",
  projects: "code",
  certifications: "badge",
  achievements: "star",
  languages: "globe",
  links: "link",
};

export function createSectionItem(section) {
  const id = createId();
  switch (section) {
    case "experience":
      return { id, company: "", position: "", location: "", startDate: "", endDate: "", current: false, description: "" };
    case "education":
      return { id, school: "", degree: "", area: "", grade: "", startDate: "", endDate: "", description: "" };
    case "skills":
      return { id, name: "", level: 3, keywords: [] };
    case "projects":
      return { id, name: "", startDate: "", endDate: "", website: "", description: "" };
    case "certifications":
      return { id, title: "", date: "", issuer: "", description: "" };
    case "achievements":
      return { id, title: "", date: "", description: "" };
    case "languages":
      return { id, language: "", level: 3 };
    case "links":
      return { id, network: "", url: "", username: "" };
    default:
      return { id, title: "", subtitle: "", date: "", description: "" };
  }
}

export function createDefaultResume() {
  return {
    id: createId(),
    title: "Untitled Resume",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    data: {
      basics: {
        name: "",
        email: "",
        phone: "",
        location: "",
        website: "",
        headline: "",
        usePhoto: false,
        profileImage: "",
      },
      summary: "",
      experience: [],
      education: [],
      skills: [],
      projects: [],
      certifications: [],
      achievements: [],
      languages: [],
      links: [],
      custom: [],
      rawText: "", // Added for ATS matching
      atsAnalysis: null, // Added for storing ATS results
    },

    design: {
      template: "classic",
      colors: { primary: "#C2410C", text: "#15110D", background: "#FFFFFF" },
      typography: {
        fontFamily: "Helvetica",
        headingFamily: "Helvetica-Bold",
        fontSize: 10,
        lineHeight: 1.35,
      },
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
      sectionOrder: ["summary", "experience", "education", "skills", "projects", "certifications", "achievements", "languages", "links"],
      sectionVisibility: {
        summary: true, experience: true, education: true, skills: true,
        projects: true, certifications: false, achievements: false,
        languages: true, links: true,
      },
    },
  };
}

export function itemDisplayTitle(section, item) {
  switch (section) {
    case "experience": return item.position || item.company || "New Position";
    case "education": return item.degree || item.school || "New Education";
    case "skills": return item.name || "New Skill";
    case "projects": return item.name || "New Project";
    case "certifications": return item.title || "New Certification";
    case "achievements": return item.title || "New Achievement";
    case "languages": return item.language || "New Language";
    case "links": return item.network || item.url || "New Link";
    default: return item.title || "New Item";
  }
}

export function itemDisplaySubtitle(section, item) {
  switch (section) {
    case "experience": return item.company || "";
    case "education": return item.school || "";
    case "skills": return item.keywords?.join(", ") || "";
    case "projects": return [item.startDate, item.endDate].filter(Boolean).join(" – ") || "";
    case "certifications": return item.issuer || "";
    case "achievements": return item.date || "";
    case "languages": return ["Beginner", "Elementary", "Intermediate", "Advanced", "Native"][item.level - 1] || "";
    case "links": return item.url || "";
    default: return item.subtitle || "";
  }
}

export const TEMPLATE_IDS = ["classic", "modern", "minimal", "compact", "timeline", "executive"];

export const TEMPLATE_META = {
  classic: { label: "ATS Clean", desc: "Single column, maximum parseability" },
  modern: { label: "Sidebar", desc: "Narrow rail + main body" },
  minimal: { label: "Minimal", desc: "Quiet hierarchy, extra whitespace" },
  compact: { label: "Compact", desc: "Dense rows, more per page" },
  timeline: { label: "Timeline", desc: "Vertical rail + dated entries" },
  executive: { label: "Executive", desc: "Two-column professional split" },
};

/** All selectable resume layout templates (PDF uses closest engine per id). */
export const TEMPLATES = TEMPLATE_IDS;

export const FONT_OPTIONS = [
  { label: "Helvetica", value: "Helvetica", heading: "Helvetica-Bold" },
  { label: "Times Roman", value: "Times-Roman", heading: "Times-Bold" },
  { label: "Courier", value: "Courier", heading: "Courier-Bold" },
];
