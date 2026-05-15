import { pdf } from "@react-pdf/renderer";
import React from "react";
import { ClassicTemplate } from "./templates/Classic";
import { ModernTemplate } from "./templates/Modern";
import { MinimalTemplate } from "./templates/Minimal";
import { sanitizeResume } from "./store";

const PDF_TEMPLATES = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  compact: MinimalTemplate,
  timeline: ModernTemplate,
  executive: ClassicTemplate,
};

export async function generatePdfBlob(resume) {
  const safe = sanitizeResume(resume ?? {});
  const Template = PDF_TEMPLATES[safe.design.template] || ClassicTemplate;
  const doc = React.createElement(Template, { resume: safe });
  const blob = await pdf(doc).toBlob();
  return blob;
}

export async function downloadPdf(resume, filename) {
  const blob = await generatePdfBlob(resume);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = sanitizeResume(resume ?? {});
  a.download = filename || `${safe.data.basics.name || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
