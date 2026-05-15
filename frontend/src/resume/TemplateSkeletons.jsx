import React from "react";

const bar = (w, h = 3, o = 0.35) => ({
  height: h,
  width: w,
  maxWidth: "100%",
  borderRadius: 1,
  background: `rgba(21,17,13,${o})`,
});

/** Mini layout preview (not pixel-perfect export) for template picker. */
export function TemplateLayoutSkeleton({ variant }) {
  const page = {
    width: "100%",
    aspectRatio: "100 / 132",
    borderRadius: 8,
    background: "#faf8f4",
    border: "1px solid rgba(21,17,13,0.12)",
    padding: 5,
    boxSizing: "border-box",
    display: "grid",
    gap: 3,
    overflow: "hidden",
  };

  switch (variant) {
    case "classic":
      return (
        <div style={{ ...page, gridTemplateRows: "auto 1fr auto", gridTemplateColumns: "1fr" }}>
          <div style={{ ...bar("55%", 5, 0.5) }} />
          <div className="stack" style={{ gap: 2 }}>
            <div style={bar("100%", 2, 0.2)} />
            <div style={bar("92%", 2, 0.2)} />
            <div style={bar("88%", 2, 0.2)} />
            <div style={{ marginTop: 3, ...bar("28%", 3, 0.35) }} />
            <div style={bar("100%", 2, 0.18)} />
            <div style={bar("96%", 2, 0.18)} />
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <div style={bar("32%", 3, 0.35)} />
            <div style={bar("100%", 2, 0.16)} />
            <div style={bar("94%", 2, 0.16)} />
          </div>
        </div>
      );
    case "modern":
      return (
        <div style={{ ...page, gridTemplateColumns: "28% 1fr", gridTemplateRows: "1fr", gap: 4 }}>
          <div className="stack" style={{ gap: 2, background: "rgba(194,65,12,0.12)", borderRadius: 4, padding: 3 }}>
            <div style={bar("80%", 4, 0.45)} />
            <div style={bar("100%", 2, 0.2)} />
            <div style={bar("90%", 2, 0.2)} />
            <div style={{ flex: 1 }} />
            <div style={bar("70%", 2, 0.25)} />
          </div>
          <div className="stack" style={{ gap: 2, paddingTop: 1 }}>
            <div style={bar("40%", 3, 0.35)} />
            <div style={bar("100%", 2, 0.18)} />
            <div style={bar("95%", 2, 0.18)} />
            <div style={bar("88%", 2, 0.18)} />
            <div style={{ marginTop: 4, ...bar("36%", 3, 0.32) }} />
            <div style={bar("100%", 2, 0.16)} />
            <div style={bar("92%", 2, 0.16)} />
          </div>
        </div>
      );
    case "minimal":
      return (
        <div style={{ ...page, gridTemplateRows: "1fr", padding: 8, gap: 6 }}>
          <div style={{ ...bar("42%", 4, 0.4), margin: "0 auto" }} />
          <div className="stack" style={{ gap: 3, alignItems: "center" }}>
            <div style={{ ...bar("70%", 2, 0.15), margin: "0 auto" }} />
            <div style={{ ...bar("55%", 2, 0.15), margin: "0 auto" }} />
          </div>
          <div style={{ flex: 1 }} />
          <div className="stack" style={{ gap: 2 }}>
            <div style={bar("22%", 3, 0.3)} />
            <div style={bar("100%", 2, 0.14)} />
            <div style={bar("78%", 2, 0.14)} />
          </div>
        </div>
      );
    case "compact":
      return (
        <div style={{ ...page, gridTemplateRows: "repeat(8, 1fr)", gap: 2, padding: 4 }}>
          <div style={bar("48%", 4, 0.45)} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <div style={bar("100%", 2, 0.16)} />
              <div style={bar("100%", 2, 0.16)} />
            </div>
          ))}
        </div>
      );
    case "timeline":
      return (
        <div style={{ ...page, display: "flex", gap: 4, padding: 5 }}>
          <div style={{ width: 3, borderRadius: 2, background: "rgba(194,65,12,0.35)", position: "relative" }}>
            {[6, 22, 38].map((top) => (
              <div
                key={top}
                style={{
                  position: "absolute",
                  left: -2,
                  top,
                  width: 7,
                  height: 7,
                  borderRadius: 99,
                  background: "#C2410C",
                  border: "1px solid #faf8f4",
                }}
              />
            ))}
          </div>
          <div className="stack" style={{ flex: 1, gap: 3 }}>
            <div style={bar("55%", 4, 0.42)} />
            <div style={bar("100%", 2, 0.18)} />
            <div style={bar("92%", 2, 0.18)} />
            <div style={{ marginTop: 4, ...bar("100%", 2, 0.16) }} />
            <div style={bar("88%", 2, 0.16)} />
            <div style={{ marginTop: 6, ...bar("38%", 3, 0.32) }} />
            <div style={bar("100%", 2, 0.15)} />
          </div>
        </div>
      );
    case "executive":
      return (
        <div style={{ ...page, gridTemplateRows: "auto 1fr", gap: 4 }}>
          <div style={bar("50%", 5, 0.48)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <div className="stack" style={{ gap: 2 }}>
              <div style={bar("40%", 3, 0.32)} />
              <div style={bar("100%", 2, 0.16)} />
              <div style={bar("94%", 2, 0.16)} />
              <div style={bar("90%", 2, 0.16)} />
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <div style={bar("38%", 3, 0.32)} />
              <div style={bar("100%", 2, 0.16)} />
              <div style={bar("92%", 2, 0.16)} />
              <div style={bar("88%", 2, 0.16)} />
            </div>
          </div>
        </div>
      );
    default:
      return <div style={page} />;
  }
}
