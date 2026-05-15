import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/ui";
import { downloadPdf } from "./pdf-export";
import { downloadResumeRaster } from "./raster-export";
import { downloadResumeDoc } from "./doc-export";

const ITEMS = [
  { key: "pdf", label: "PDF", sub: "Print-ready" },
  { key: "png", label: "PNG", sub: "Image" },
  { key: "jpeg", label: "JPEG", sub: "Image" },
  { key: "doc", label: "Word (.doc)", sub: "HTML for Word" },
  { key: "dot", label: "Word (.dot)", sub: "Same content, .dot" },
];

export function ResumeExportMenu({ resume }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      window.alert(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!resume) return null;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-accent btn-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Icon name="download" size={12} />
        Export
        <Icon name="chevD" size={11} style={{ opacity: 0.85, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: 200,
            padding: 4,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          {ITEMS.map((it) => (
            <button
              key={it.key}
              type="button"
              role="option"
              disabled={!!busy}
              className="btn btn-ghost btn-sm"
              style={{
                width: "100%",
                justifyContent: "space-between",
                fontWeight: 500,
                padding: "8px 10px",
                borderRadius: 8,
              }}
              onClick={() => {
                if (it.key === "pdf") return run("pdf", () => downloadPdf(resume));
                if (it.key === "png") return run("png", () => downloadResumeRaster(resume, "png"));
                if (it.key === "jpeg") return run("jpeg", () => downloadResumeRaster(resume, "jpeg"));
                if (it.key === "doc") return run("doc", async () => downloadResumeDoc(resume, "doc"));
                if (it.key === "dot") return run("dot", async () => downloadResumeDoc(resume, "dot"));
              }}
            >
              <span className="center" style={{ gap: 8 }}>
                <Icon name="file" size={14} style={{ color: "var(--accent)", opacity: 0.9 }} />
                <span style={{ textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 13 }}>{it.label}</span>
                  <span className="muted" style={{ fontSize: 10, fontWeight: 400 }}>{it.sub}</span>
                </span>
              </span>
              {busy === it.key ? <span className="muted" style={{ fontSize: 11 }}>…</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
