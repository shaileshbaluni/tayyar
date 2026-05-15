import { sanitizeResume } from "./store";
import { SECTION_TYPES, SECTION_LABELS } from "./schema";

const t = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

function basicsFilledCount(data) {
  const b = data.basics || {};
  const keys = ["name", "headline", "email", "phone", "location", "website"];
  let n = keys.reduce((acc, k) => acc + (t(b[k]) ? 1 : 0), 0);
  if (b.usePhoto) n += t(b.profileImage) ? 1 : 0;
  return n;
}

function basicsTotal(data) {
  const b = data?.basics || {};
  return 6 + (b.usePhoto ? 1 : 0);
}

function titleFilled(resume) {
  return t(resume.title) && resume.title !== "Untitled Resume" ? 1 : 0;
}

function summaryScore(data) {
  const s = t(data.summary || "");
  if (s.length >= 120) return { filled: 1, total: 1 };
  if (s.length >= 40) return { filled: 0.5, total: 1 };
  return { filled: s.length > 0 ? 0.25 : 0, total: 1 };
}

function listSectionScore(section, items) {
  const arr = Array.isArray(items) ? items : [];
  const scoreItem = (it) => {
    switch (section) {
      case "experience": {
        let f = 0;
        const slots = 3;
        if (t(it.position) && t(it.company)) f += 1;
        if (t(it.startDate) && (it.current || t(it.endDate))) f += 1;
        if (t(it.description).length > 20) f += 1;
        return Math.min(f, slots);
      }
      case "education": {
        let f = 0;
        const slots = 3;
        if (t(it.degree) && t(it.school)) f += 1;
        if (t(it.startDate) || t(it.endDate)) f += 1;
        if (t(it.description).length > 12 || t(it.grade)) f += 1;
        return Math.min(f, slots);
      }
      case "skills":
        return t(it.name) ? 1 : 0;
      case "projects": {
        let f = 0;
        if (t(it.name)) f += 0.5;
        if (t(it.description).length > 15) f += 0.5;
        return f;
      }
      case "certifications":
      case "achievements": {
        let f = 0;
        if (t(it.title)) f += 0.5;
        if (t(it.description).length > 10 || t(it.date) || t(it.issuer)) f += 0.5;
        return f;
      }
      case "languages": {
        return t(it.language) ? 1 : 0;
      }
      case "links": {
        return t(it.url) || t(it.network) ? 1 : 0;
      }
      default:
        return 0;
    }
  };

  const slotsPer = section === "skills" || section === "languages" || section === "links" ? 1 : section === "experience" || section === "education" ? 3 : 2;
  const minSlots =
    section === "skills" ? 3 : section === "languages" ? 2 : section === "links" ? 1 : section === "experience" || section === "education" ? 3 : 2;

  if (arr.length === 0) {
    return { filled: 0, total: minSlots };
  }

  let filled = 0;
  for (const it of arr) {
    filled += scoreItem(it);
  }
  const total = Math.max(minSlots, arr.length * slotsPer);
  return { filled: Math.min(filled, total), total };
}

/** Per-tab completion for pills: "Personal 5/7" */
export function getTabCompletion(resume, tabKey) {
  const safe = sanitizeResume(resume ?? {});
  const { data } = safe;

  if (tabKey === "basics") {
    const b = basicsFilledCount(data);
    const ti = titleFilled(safe);
    const filled = b + ti;
    const total = basicsTotal(data) + 1;
    return { filled, total, label: "Personal" };
  }

  if (tabKey === "summary") {
    const { filled, total } = summaryScore(data);
    return { filled, total, label: SECTION_LABELS.summary };
  }

  if (SECTION_TYPES.includes(tabKey)) {
    const { filled, total } = listSectionScore(tabKey, data[tabKey]);
    return { filled, total, label: SECTION_LABELS[tabKey] || tabKey };
  }

  return { filled: 0, total: 1, label: tabKey };
}

export function getResumeCompletionAggregate(resume) {
  const safe = sanitizeResume(resume ?? {});
  const order = safe.design?.sectionOrder || SECTION_TYPES;

  const tabs = ["basics", "summary", ...order];
  let filled = 0;
  let total = 0;
  const byTab = {};
  for (const key of tabs) {
    const c = getTabCompletion(safe, key);
    byTab[key] = c;
    filled += c.filled;
    total += c.total;
  }

  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  const essentials = {
    name: t(safe.data.basics?.name),
    email: t(safe.data.basics?.email),
    summary: t(safe.data.summary || "").length >= 40,
    exp: Array.isArray(safe.data.experience) && safe.data.experience.some((e) => t(e.position) && t(e.company)),
    edu: Array.isArray(safe.data.education) && safe.data.education.some((e) => t(e.school) && t(e.degree)),
  };
  const needAts = [essentials.name, essentials.email, essentials.summary, essentials.exp, essentials.edu].filter(Boolean).length;
  const atsTarget = 5;
  const atsRemaining = Math.max(0, atsTarget - needAts);

  return { filled, total, pct, byTab, atsRemaining, essentials };
}

export function formatRelativeSaved(iso) {
  if (!iso) return "just now";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
