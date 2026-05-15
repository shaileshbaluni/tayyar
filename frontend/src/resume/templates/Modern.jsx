import React from "react";
import { Document, Page, View, Text, Link } from "@react-pdf/renderer";
import { dateRange, levelDots, Divider, SectionTitle, renderBullets, getVisibleSections, summaryTextForPdf, ProfilePhoto } from "./shared";

const SIDEBAR_SECTIONS = ["skills", "languages", "links", "certifications"];

export const ModernTemplate = ({ resume }) => {
  const { data, design } = resume;
  const { basics } = data;
  const { colors, typography, margins } = design;
  const fs = typography.fontSize;
  const lh = typography.lineHeight;
  const sections = getVisibleSections(resume);

  const sidebar = sections.filter((s) => SIDEBAR_SECTIONS.includes(s));
  const main = sections.filter((s) => !SIDEBAR_SECTIONS.includes(s));

  const txt = { fontSize: fs, color: colors.text, lineHeight: lh, fontFamily: typography.fontFamily };
  const sub = { ...txt, fontSize: fs - 1, color: "#6B7280" };
  const light = { ...txt, fontSize: fs - 1, color: "#FFFFFF" };

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: typography.fontFamily }}>
        {/* Header band */}
        <View
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 18,
            paddingHorizontal: margins.left,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <ProfilePhoto basics={basics} size={52} />
          <View style={{ flex: 1 }}>
            {basics.name ? (
              <Text style={{ fontSize: fs + 12, fontFamily: "Helvetica-Bold", color: "#FFFFFF", marginBottom: 2 }}>
                {basics.name}
              </Text>
            ) : (
              <Text style={{ fontSize: fs + 12, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
                Your name
              </Text>
            )}
            {basics.headline ? (
              <Text style={{ fontSize: fs + 1, color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>{basics.headline}</Text>
            ) : (
              <Text style={{ fontSize: fs + 1, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>Professional headline</Text>
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {basics.email && <Text style={light}>{basics.email}</Text>}
              {basics.phone && <Text style={light}>{basics.phone}</Text>}
              {basics.location && <Text style={light}>{basics.location}</Text>}
              {basics.website && <Link src={basics.website} style={{ ...light, textDecoration: "underline" }}>{basics.website}</Link>}
            </View>
          </View>
        </View>

        {/* Body: two columns */}
        <View style={{ flexDirection: "row", flex: 1 }}>
          {/* Main column */}
          <View style={{ flex: 3, paddingTop: 12, paddingRight: 14, paddingBottom: margins.bottom, paddingLeft: margins.left }}>
            {main.map((section) => (
              <View key={section} style={{ marginBottom: 10 }} wrap={false}>
                {renderMainSection(section, data, { txt, sub, fs, lh, colors })}
              </View>
            ))}
          </View>

          {/* Sidebar */}
          {sidebar.length > 0 && (
            <View style={{ flex: 1.2, backgroundColor: "#F9FAFB", paddingTop: 12, paddingRight: margins.right, paddingBottom: margins.bottom, paddingLeft: 12 }}>
              {sidebar.map((section) => (
                <View key={section} style={{ marginBottom: 10 }} wrap={false}>
                  {renderSidebarSection(section, data, { txt, sub, fs, lh, colors })}
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

function renderMainSection(section, data, s) {
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
    default:
      return null;
  }
}

function renderSidebarSection(section, data, s) {
  switch (section) {
    case "skills":
      return (
        <>
          <SectionTitle color={s.colors.primary} fontSize={s.fs}>Skills</SectionTitle>
          {data.skills.map((sk) => (
            <View key={sk.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ ...s.txt, fontSize: s.fs - 1 }}>{sk.name}</Text>
                {levelDots(sk.level, 5, s.colors.primary)}
              </View>
              {sk.keywords?.length > 0 && (
                <Text style={{ ...s.sub, fontSize: s.fs - 2 }}>{sk.keywords.join(", ")}</Text>
              )}
            </View>
          ))}
        </>
      );
    case "languages":
      return (
        <>
          <SectionTitle color={s.colors.primary} fontSize={s.fs}>Languages</SectionTitle>
          {data.languages.map((l) => (
            <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 }}>
              <Text style={{ ...s.txt, fontSize: s.fs - 1 }}>{l.language}</Text>
              {levelDots(l.level, 5, s.colors.primary)}
            </View>
          ))}
        </>
      );
    case "links":
      return (
        <>
          <SectionTitle color={s.colors.primary} fontSize={s.fs}>Links</SectionTitle>
          {data.links.map((l) => (
            <View key={l.id} style={{ marginBottom: 3 }}>
              {l.network && <Text style={{ ...s.txt, fontSize: s.fs - 1, fontFamily: "Helvetica-Bold" }}>{l.network}</Text>}
              <Link src={l.url} style={{ ...s.sub, fontSize: s.fs - 2, color: s.colors.primary }}>
                {l.username || l.url}
              </Link>
            </View>
          ))}
        </>
      );
    case "certifications":
      return (
        <>
          <SectionTitle color={s.colors.primary} fontSize={s.fs}>Certifications</SectionTitle>
          {data.certifications.map((c) => (
            <View key={c.id} style={{ marginBottom: 4 }}>
              <Text style={{ ...s.txt, fontSize: s.fs - 1, fontFamily: "Helvetica-Bold" }}>{c.title}</Text>
              {c.issuer && <Text style={{ ...s.sub, fontSize: s.fs - 2 }}>{c.issuer}</Text>}
              {c.date && <Text style={{ ...s.sub, fontSize: s.fs - 2 }}>{c.date}</Text>}
            </View>
          ))}
        </>
      );
    default:
      return null;
  }
}
