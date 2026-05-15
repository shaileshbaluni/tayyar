import React from "react";
import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { dateRange, renderBullets, getVisibleSections, summaryTextForPdf, ProfilePhoto } from "./shared";

export const MinimalTemplate = ({ resume }) => {
  const { data, design } = resume;
  const { basics } = data;
  const { colors, typography, margins } = design;
  const fs = typography.fontSize;
  const lh = typography.lineHeight;
  const sections = getVisibleSections(resume);

  const txt = { fontSize: fs, color: colors.text, lineHeight: lh, fontFamily: typography.fontFamily };
  const sub = { ...txt, fontSize: fs - 1, color: "#9CA3AF" };
  const heading = { fontSize: fs + 1, fontFamily: "Helvetica-Bold", color: colors.text, marginBottom: 4, marginTop: 10 };
  const rule = { borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", marginBottom: 6 };

  return (
    <Document>
      <Page size="A4" style={{ paddingTop: margins.top + 10, paddingRight: margins.right + 8, paddingBottom: margins.bottom, paddingLeft: margins.left + 8, fontFamily: typography.fontFamily }}>
        {/* Header — left-aligned, minimal */}
        <View style={{ marginBottom: 14, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <ProfilePhoto basics={basics} size={48} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            {basics.name ? (
              <Text style={{ fontSize: fs + 14, fontFamily: "Helvetica-Bold", color: colors.text, letterSpacing: 0.5 }}>
                {basics.name}
              </Text>
            ) : (
              <Text style={{ fontSize: fs + 14, fontFamily: "Helvetica-Bold", color: "#E5E7EB", letterSpacing: 0.5 }}>
                Your name
              </Text>
            )}
            {basics.headline ? (
              <Text style={{ fontSize: fs, color: "#9CA3AF", marginTop: 2 }}>{basics.headline}</Text>
            ) : (
              <Text style={{ fontSize: fs, color: "#D1D5DB", marginTop: 2 }}>Professional headline</Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
              {basics.email && <Text style={sub}>{basics.email}</Text>}
              {basics.phone && <Text style={sub}>{basics.phone}</Text>}
              {basics.location && <Text style={sub}>{basics.location}</Text>}
              {basics.website && <Link src={basics.website} style={{ ...sub, color: colors.primary }}>{basics.website}</Link>}
            </View>
          </View>
        </View>

        <View style={rule} />

        {sections.map((section) => (
          <View key={section} wrap={false}>
            {renderSection(section, data, { txt, sub, heading, rule, fs, lh, colors })}
          </View>
        ))}
      </Page>
    </Document>
  );
};

function renderSection(section, data, s) {
  switch (section) {
    case "summary": {
      const body = summaryTextForPdf(data);
      const placeholder = !(data.summary || "").trim();
      return (
        <>
          <Text style={s.heading}>Summary</Text>
          <Text style={{ ...s.txt, marginBottom: 6, color: placeholder ? "#9CA3AF" : s.colors.text }}>
            {body}
          </Text>
          <View style={s.rule} />
        </>
      );
    }
    case "experience":
      return (
        <>
          <Text style={s.heading}>Experience</Text>
          {data.experience.map((e) => (
            <View key={e.id} style={{ marginBottom: 8 }}>
              <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{e.position}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={s.sub}>{[e.company, e.location].filter(Boolean).join(", ")}</Text>
                <Text style={s.sub}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
              </View>
              {renderBullets(e.description, s.fs, s.colors.text)}
            </View>
          ))}
          <View style={s.rule} />
        </>
      );
    case "education":
      return (
        <>
          <Text style={s.heading}>Education</Text>
          {data.education.map((e) => (
            <View key={e.id} style={{ marginBottom: 6 }}>
              <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{e.degree}{e.area ? ` in ${e.area}` : ""}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.sub}>{[e.school, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join(" · ")}</Text>
                <Text style={s.sub}>{dateRange(e.startDate, e.endDate)}</Text>
              </View>
              {e.description && <Text style={{ ...s.txt, marginTop: 2 }}>{e.description}</Text>}
            </View>
          ))}
          <View style={s.rule} />
        </>
      );
    case "skills":
      return (
        <>
          <Text style={s.heading}>Skills</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {data.skills.map((sk) => (
              <View key={sk.id} style={{ backgroundColor: "#F3F4F6", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 }}>
                <Text style={{ fontSize: s.fs - 1, color: s.colors.text }}>
                  {sk.name}{sk.keywords?.length > 0 ? ` (${sk.keywords.join(", ")})` : ""}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.rule} />
        </>
      );
    case "projects":
      return (
        <>
          <Text style={s.heading}>Projects</Text>
          {data.projects.map((p) => (
            <View key={p.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{p.name}</Text>
                <Text style={s.sub}>{dateRange(p.startDate, p.endDate)}</Text>
              </View>
              {p.website && <Link src={p.website} style={{ ...s.sub, fontSize: s.fs - 2, color: s.colors.primary }}>{p.website}</Link>}
              {renderBullets(p.description, s.fs, s.colors.text)}
            </View>
          ))}
          <View style={s.rule} />
        </>
      );
    case "certifications":
      return (
        <>
          <Text style={s.heading}>Certifications</Text>
          {data.certifications.map((c) => (
            <View key={c.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{c.title}</Text>
                <Text style={s.sub}>{c.date}</Text>
              </View>
              {c.issuer && <Text style={s.sub}>{c.issuer}</Text>}
            </View>
          ))}
          <View style={s.rule} />
        </>
      );
    case "achievements":
      return (
        <>
          <Text style={s.heading}>Achievements</Text>
          {data.achievements.map((a) => (
            <View key={a.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{a.title}</Text>
                <Text style={s.sub}>{a.date}</Text>
              </View>
              {a.description && <Text style={s.txt}>{a.description}</Text>}
            </View>
          ))}
          <View style={s.rule} />
        </>
      );
    case "languages":
      return (
        <>
          <Text style={s.heading}>Languages</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
            {data.languages.map((l) => (
              <Text key={l.id} style={s.txt}>
                {l.language} — {["Beginner", "Elementary", "Intermediate", "Advanced", "Native"][l.level - 1] || ""}
              </Text>
            ))}
          </View>
          <View style={s.rule} />
        </>
      );
    case "links":
      return (
        <>
          <Text style={s.heading}>Links</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
            {data.links.map((l) => (
              <Link key={l.id} src={l.url} style={{ ...s.txt, color: s.colors.primary, textDecoration: "none" }}>
                {l.network || l.username || l.url}
              </Link>
            ))}
          </View>
          <View style={s.rule} />
        </>
      );
    default:
      return null;
  }
}
