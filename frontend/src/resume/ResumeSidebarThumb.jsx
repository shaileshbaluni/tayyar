import React from "react";

/** Slide-style miniature for the resume list (no PDF render — fast and stable). */
export function ResumeSidebarThumb({ resume }) {
  const bg = resume?.design?.colors?.background || "#ffffff";
  const primary = resume?.design?.colors?.primary || "#c2410c";
  const text = resume?.design?.colors?.text || "#15110d";
  const name = (resume?.data?.basics?.name || resume?.title || "Resume").trim() || "Resume";
  const headline = (resume?.data?.basics?.headline || "").trim();

  return (
    <div
      aria-hidden
      style={{
        width: 44,
        height: 58,
        flexShrink: 0,
        borderRadius: 5,
        border: "1px solid color-mix(in srgb, var(--line) 85%, transparent)",
        background: bg,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ height: 5, background: primary, flexShrink: 0 }} />
      <div
        style={{
          padding: "5px 6px",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div
          style={{
            fontSize: 7,
            fontWeight: 700,
            color: text,
            lineHeight: 1.15,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {name}
        </div>
        {headline ? (
          <div
            style={{
              fontSize: 6,
              lineHeight: 1.15,
              color: `color-mix(in srgb, ${text} 55%, transparent)`,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {headline}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 10,
              borderRadius: 2,
              background: `color-mix(in srgb, ${text} 8%, transparent)`,
            }}
          />
        )}
      </div>
    </div>
  );
}
