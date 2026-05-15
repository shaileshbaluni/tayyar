import React from "react";
import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { dateRange, levelDots, Divider, SectionTitle, renderBullets, getVisibleSections, summaryTextForPdf, ProfilePhoto } from "./shared";

export const ClassicTemplate = ({ resume }) => {
  const { data, design } = resume;
  const { basics } = data;
  const { colors, typography, margins } = design;
  const fs = typography.fontSize;
  const lh = typography.lineHeight;
  const sections = getVisibleSections(resume);

  const txt = { fontSize: fs, color: colors.text, lineHeight: lh, fontFamily: typography.fontFamily };
  const sub = { ...txt, fontSize: fs - 1, color: "#6B7280" };

  return (
    <Document>
      <Page size="A4" style={{ paddingTop: margins.top, paddingRight: margins.right, paddingBottom: margins.bottom, paddingLeft: margins.left, fontFamily: typography.fontFamily }}>
        {/* Header */}
        <View style={{ marginBottom: 10, alignItems: "center" }}>
          <ProfilePhoto basics={basics} size={64} style={{ marginBottom: 8 }} />
          {basics.name ? (
            <Text style={{ fontSize: fs + 10, fontFamily: "Helvetica-Bold", color: colors.text, marginBottom: 2 }}>
              {basics.name}
            </Text>
          ) : (
            <Text style={{ fontSize: fs + 10, fontFamily: "Helvetica-Bold", color: "#D1D5DB", marginBottom: 2 }}>
              Your name
            </Text>
          )}
          {basics.headline ? (
            <Text style={{ fontSize: fs + 1, color: colors.primary, marginBottom: 4 }}>{basics.headline}</Text>
          ) : (
            <Text style={{ fontSize: fs + 1, color: "#D1D5DB", marginBottom: 4 }}>Professional headline</Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {basics.email && <Text style={sub}>{basics.email}</Text>}
            {basics.phone && <Text style={sub}>{basics.phone}</Text>}
            {basics.location && <Text style={sub}>{basics.location}</Text>}
            {basics.website && <Link src={basics.website} style={sub}>{basics.website}</Link>}
          </View>
        </View>

        <Divider color={colors.primary} />

        {sections.map((section) => (
          <View key={section} style={{ marginTop: 8 }} wrap={false}>
            {renderSection(section, data, { txt, sub, fs, lh, colors })}
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
          <SectionTitle color={s.colors.primary}>Summary</SectionTitle>
          <Text style={{ ...s.txt, marginBottom: 4, color: placeholder ? "#9CA3AF" : s.colors.text }}>
            {body}
          </Text>
        </>
      );
    }
    case "experience":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Experience</SectionTitle>
          {data.experience.map((e) => (
            <View key={e.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{e.position}</Text>
                <Text style={s.sub}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
              </View>
              <Text style={{ ...s.sub, marginBottom: 2 }}>
                {[e.company, e.location].filter(Boolean).join(" · ")}
              </Text>
              {renderBullets(e.description, s.fs, s.colors.text)}
            </View>
          ))}
        </>
      );
    case "education":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Education</SectionTitle>
          {data.education.map((e) => (
            <View key={e.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{e.degree}{e.area ? ` in ${e.area}` : ""}</Text>
                <Text style={s.sub}>{dateRange(e.startDate, e.endDate)}</Text>
              </View>
              <Text style={s.sub}>
                {[e.school, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join(" · ")}
              </Text>
              {e.description && <Text style={{ ...s.txt, marginTop: 2 }}>{e.description}</Text>}
            </View>
          ))}
        </>
      );
    case "skills":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Skills</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {data.skills.map((sk) => (
              <View key={sk.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
                <Text style={s.txt}>{sk.name}</Text>
                {levelDots(sk.level, 5, s.colors.primary)}
                {sk.keywords?.length > 0 && (
                  <Text style={{ ...s.sub, fontSize: s.fs - 2 }}>({sk.keywords.join(", ")})</Text>
                )}
              </View>
            ))}
          </View>
        </>
      );
    case "projects":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Projects</SectionTitle>
          {data.projects.map((p) => (
            <View key={p.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{p.name}</Text>
                <Text style={s.sub}>{dateRange(p.startDate, p.endDate)}</Text>
              </View>
              {p.website && <Link src={p.website} style={{ ...s.sub, fontSize: s.fs - 2 }}>{p.website}</Link>}
              {renderBullets(p.description, s.fs, s.colors.text)}
            </View>
          ))}
        </>
      );
    case "certifications":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Certifications</SectionTitle>
          {data.certifications.map((c) => (
            <View key={c.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{c.title}</Text>
                <Text style={s.sub}>{c.date}</Text>
              </View>
              {c.issuer && <Text style={s.sub}>{c.issuer}</Text>}
              {c.description && <Text style={s.txt}>{c.description}</Text>}
            </View>
          ))}
        </>
      );
    case "achievements":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Achievements</SectionTitle>
          {data.achievements.map((a) => (
            <View key={a.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...s.txt, fontFamily: "Helvetica-Bold" }}>{a.title}</Text>
                <Text style={s.sub}>{a.date}</Text>
              </View>
              {a.description && <Text style={s.txt}>{a.description}</Text>}
            </View>
          ))}
        </>
      );
    case "languages":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Languages</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {data.languages.map((l) => (
              <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={s.txt}>{l.language}</Text>
                {levelDots(l.level, 5, s.colors.primary)}
              </View>
            ))}
          </View>
        </>
      );
    case "links":
      return (
        <>
          <SectionTitle color={s.colors.primary}>Links</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {data.links.map((l) => (
              <View key={l.id} style={{ marginBottom: 2 }}>
                <Link src={l.url} style={{ ...s.txt, color: s.colors.primary, textDecoration: "none" }}>
                  {l.network || l.username || l.url}
                </Link>
              </View>
            ))}
          </View>
        </>
      );
    default:
      return null;
  }
}
