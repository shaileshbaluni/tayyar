import React from "react";
import { Text, View, Image } from "@react-pdf/renderer";
import { SECTION_TYPES } from "../schema";

export function formatDate(d) {
  if (!d) return "";
  const s = typeof d === "string" ? d : String(d);
  if (s.toLowerCase() === "present") return "Present";
  const parts = s.split("-");
  if (parts.length === 1) return d;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = parseInt(parts[1], 10);
  return `${months[m - 1] || ""} ${parts[0]}`.trim();
}

export function dateRange(start, end, current) {
  const s = formatDate(start);
  const e = current ? "Present" : formatDate(end);
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

export function levelDots(level, max, color) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i < level ? color : "#D1D5DB",
          }}
        />
      ))}
    </View>
  );
}

export function hasProfilePhoto(basics) {
  return Boolean(basics?.usePhoto && basics?.profileImage);
}

/** Circular profile photo for PDF templates (only when usePhoto + image set). */
export function ProfilePhoto({ basics, size = 56, style }) {
  if (!hasProfilePhoto(basics)) return null;
  const s = size;
  return (
    <Image
      src={basics.profileImage}
      style={{
        width: s,
        height: s,
        borderRadius: s / 2,
        ...style,
      }}
    />
  );
}

export const Divider = ({ color = "#E5E7EB", marginY = 6 }) => (
  <View style={{ borderBottomWidth: 0.75, borderBottomColor: color, marginTop: marginY, marginBottom: marginY }} />
);

export const SectionTitle = ({ children, color = "#15110D", fontSize = 12 }) => (
  <Text style={{ fontSize, fontFamily: "Helvetica-Bold", color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>
    {children}
  </Text>
);

export const Bullet = ({ children, fontSize = 10, color = "#374151" }) => (
  <View style={{ flexDirection: "row", marginBottom: 2, paddingLeft: 8 }}>
    <Text style={{ fontSize, color, width: 10 }}>•</Text>
    <Text style={{ fontSize, color, flex: 1, lineHeight: 1.35 }}>{children}</Text>
  </View>
);

export function renderBullets(text, fontSize, color) {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.map((line, i) => (
    <Bullet key={i} fontSize={fontSize} color={color}>
      {line.replace(/^[\-\*•]\s*/, "")}
    </Bullet>
  ));
}

/** Shown in PDF preview when summary is still empty — avoids a totally blank page on “New resume”. */
export const EMPTY_RESUME_SUMMARY_HINT =
  "Add your professional summary in the editor on the left — this preview updates as you type.";

export function summaryTextForPdf(data) {
  const t = (data.summary || "").trim();
  return t || EMPTY_RESUME_SUMMARY_HINT;
}

export function getVisibleSections(resume) {
  const design = resume?.design;
  const data = resume?.data;
  if (!design || !data) {
    return ["summary"];
  }
  const sectionOrder = Array.isArray(design.sectionOrder) ? design.sectionOrder : SECTION_TYPES;
  const sectionVisibility =
    design.sectionVisibility && typeof design.sectionVisibility === "object"
      ? design.sectionVisibility
      : {};
  const visible = sectionOrder.filter((s) => sectionVisibility[s] !== false);
  const withContent = visible.filter((s) => hasContent(data, s));
  if (withContent.length > 0) return withContent;
  // New resume: nothing passes hasContent() yet — still render Summary so preview isn’t blank
  if (visible.includes("summary")) return ["summary"];
  return visible.length ? [visible[0]] : [];
}

function hasContent(data, section) {
  if (!data || typeof data !== "object") return false;
  if (section === "summary") return !!data.summary;
  const arr = data[section];
  return Array.isArray(arr) && arr.length > 0;
}
