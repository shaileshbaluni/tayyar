import { sanitizeResume } from "./store";
import { SECTION_LABELS } from "./schema";
import { hasProfilePhoto } from "./templates/shared";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s) {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

/** Word opens HTML saved with a .doc or .dot filename (legacy HTML-in-Word compatibility). */
export function downloadResumeDoc(resume, extension = "doc") {
  const safe = sanitizeResume(resume ?? {});
  const { basics, summary } = safe.data;
  const blocks = [];

  if (hasProfilePhoto(basics)) {
    blocks.push(
      `<p style="margin:0 0 10pt;"><img src="${basics.profileImage}" alt="" width="72" height="72" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" /></p>`,
    );
  }
  blocks.push(`<h1 style="font-size:22pt;margin:0 0 6pt;">${escapeHtml(basics.name || "Resume")}</h1>`);
  if (basics.headline) blocks.push(`<p style="margin:0 0 12pt;font-size:12pt;"><b>${escapeHtml(basics.headline)}</b></p>`);
  const contact = [basics.email, basics.phone, basics.location, basics.website].filter(Boolean).join(" · ");
  if (contact) blocks.push(`<p style="margin:0 0 14pt;font-size:10pt;">${escapeHtml(contact)}</p>`);

  if (summary) {
    blocks.push(`<h2 style="font-size:13pt;border-bottom:1pt solid #333;">${escapeHtml(SECTION_LABELS.summary)}</h2>`);
    blocks.push(`<p style="font-size:11pt;line-height:1.35;">${nl2br(summary)}</p>`);
  }

  const listSection = (title, items, renderItem) => {
    if (!Array.isArray(items) || items.length === 0) return;
    blocks.push(`<h2 style="font-size:13pt;margin-top:14pt;border-bottom:1pt solid #333;">${escapeHtml(title)}</h2>`);
    items.forEach((it) => {
      blocks.push(`<div style="margin-bottom:10pt;">${renderItem(it)}</div>`);
    });
  };

  listSection(SECTION_LABELS.experience, safe.data.experience, (it) => {
    const head = [it.position, it.company].filter(Boolean).join(" — ");
    const dates = [it.startDate, it.current ? "Present" : it.endDate].filter(Boolean).join(" – ");
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(head)}</b></p>
      ${dates ? `<p style="margin:2pt 0;font-size:10pt;color:#444;">${escapeHtml(dates)}${it.location ? ` · ${escapeHtml(it.location)}` : ""}</p>` : ""}
      ${it.description ? `<p style="margin:4pt 0 0;font-size:10pt;">${nl2br(it.description)}</p>` : ""}`;
  });

  listSection(SECTION_LABELS.education, safe.data.education, (it) => {
    const head = [it.degree, it.school].filter(Boolean).join(" — ");
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(head)}</b></p>
      ${it.area ? `<p style="margin:2pt 0;font-size:10pt;">${escapeHtml(it.area)}</p>` : ""}
      ${it.description ? `<p style="margin:4pt 0 0;font-size:10pt;">${nl2br(it.description)}</p>` : ""}`;
  });

  listSection(SECTION_LABELS.skills, safe.data.skills, (it) => {
    const kw = Array.isArray(it.keywords) ? it.keywords.join(", ") : "";
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(it.name || "Skill")}</b>${kw ? ` — ${escapeHtml(kw)}` : ""}</p>`;
  });

  listSection(SECTION_LABELS.projects, safe.data.projects, (it) => {
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(it.name || "Project")}</b></p>
      ${it.website ? `<p style="margin:2pt 0;font-size:10pt;">${escapeHtml(it.website)}</p>` : ""}
      ${it.description ? `<p style="margin:4pt 0 0;font-size:10pt;">${nl2br(it.description)}</p>` : ""}`;
  });

  listSection(SECTION_LABELS.certifications, safe.data.certifications, (it) => {
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(it.title || "")}</b></p>
      <p style="margin:2pt 0;font-size:10pt;">${escapeHtml([it.issuer, it.date].filter(Boolean).join(" · "))}</p>
      ${it.description ? `<p style="margin:4pt 0 0;font-size:10pt;">${nl2br(it.description)}</p>` : ""}`;
  });

  listSection(SECTION_LABELS.achievements, safe.data.achievements, (it) => {
    return `<p style="margin:0;font-size:11pt;"><b>${escapeHtml(it.title || "")}</b>${it.date ? ` <span style="color:#444;">(${escapeHtml(it.date)})</span>` : ""}</p>
      ${it.description ? `<p style="margin:4pt 0 0;font-size:10pt;">${nl2br(it.description)}</p>` : ""}`;
  });

  listSection(SECTION_LABELS.languages, safe.data.languages, (it) => {
    return `<p style="margin:0;font-size:11pt;">${escapeHtml(it.language || "")}</p>`;
  });

  listSection(SECTION_LABELS.links, safe.data.links, (it) => {
    return `<p style="margin:0;font-size:11pt;">${escapeHtml(it.network || "Link")}: ${escapeHtml(it.url || it.username || "")}</p>`;
  });

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(basics.name || "Resume")}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;">${blocks.join("\n")}</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = extension === "dot" ? "dot" : "doc";
  a.download = `${(basics.name || "resume").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "resume"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
