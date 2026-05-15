import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { generatePdfBlob } from "./pdf-export";
import { pdfjsLib } from "./pdfjs-setup";

function isRenderingCancelled(err) {
  if (!err) return false;
  if (err.name === "RenderingCancelledException") return true;
  const m = String(err.message || err);
  return /cancel/i.test(m) && /render/i.test(m);
}

function useDebouncedResume(resume, delayMs) {
  const [debounced, setDebounced] = useState(resume);
  const resumeId = resume?.id;

  useEffect(() => {
    setDebounced(resume);
  }, [resumeId]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(resume), delayMs);
    return () => window.clearTimeout(t);
  }, [resume, delayMs]);

  return debounced;
}

function measureViewport(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 24 || r.height < 24) return null;
  return { w: Math.round(r.width), h: Math.round(r.height) };
}

function boxesNearEqual(a, b, eps = 3) {
  return Math.abs(a.w - b.w) <= eps && Math.abs(a.h - b.h) <= eps;
}

/**
 * Live PDF preview: page tabs, fit-to-view, zoom, ATS badge.
 * @param {boolean} visible When false (mobile edit pane), skip paint until shown.
 */
export const ResumePreview = ({ resume, zoom = 100, onZoom, isMobile = false, visible = true }) => {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const pdfDocRef = useRef(null);
  const fitBoxRef = useRef(null);
  const loadTaskRef = useRef(0);
  const renderTaskRef = useRef(null);
  const paintRunRef = useRef(0);
  const resizeDebounceRef = useRef(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(null);
  const [numPages, setNumPages] = useState(1);
  const [page, setPage] = useState(1);
  const [docGen, setDocGen] = useState(0);
  const [fitBoxVersion, setFitBoxVersion] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);

  const debouncedResume = useDebouncedResume(resume, 450);

  const commitFitBox = useCallback((box) => {
    if (!box) return false;
    const prev = fitBoxRef.current;
    if (prev && boxesNearEqual(prev, box)) return false;
    fitBoxRef.current = box;
    setFitBoxVersion((v) => v + 1);
    return true;
  }, []);

  useEffect(() => {
    setPage(1);
  }, [resume?.id]);

  useLayoutEffect(() => {
    if (!visible) {
      setCanvasReady(false);
      return;
    }
    const measure = () => commitFitBox(measureViewport(viewportRef.current));
    measure();
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [visible, commitFitBox]);

  useEffect(() => {
    if (!visible) return;
    const el = viewportRef.current;
    if (!el) return;

    const schedule = () => {
      if (resizeDebounceRef.current) window.clearTimeout(resizeDebounceRef.current);
      resizeDebounceRef.current = window.setTimeout(() => {
        resizeDebounceRef.current = null;
        commitFitBox(measureViewport(el));
      }, 150);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (resizeDebounceRef.current) window.clearTimeout(resizeDebounceRef.current);
    };
  }, [visible, commitFitBox]);

  const cancelActiveRender = useCallback(() => {
    const t = renderTaskRef.current;
    if (t) {
      try {
        t.cancel();
      } catch (_) {
        /* ignore */
      }
      renderTaskRef.current = null;
    }
  }, []);

  const paintPage = useCallback(
    async (doc, pageNum, box, zoomPct, run, mobileFit) => {
      const canvas = canvasRef.current;
      if (!doc || !canvas || !box) return;
      cancelActiveRender();

      const p = Math.min(Math.max(1, pageNum), doc.numPages || 1);
      const pdfPage = await doc.getPage(p);
      if (run !== paintRunRef.current) return;

      const base = pdfPage.getViewport({ scale: 1 });
      const padX = 8;
      const padY = 8;
      const availW = Math.max(80, box.w - padX * 2);
      const availH = Math.max(100, box.h - padY * 2);
      const fit = Math.min(availW / base.width, availH / base.height);
      const z = mobileFit ? 1 : Math.min(150, Math.max(50, zoomPct)) / 100;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const renderScale = fit * z * dpr;
      const viewport = pdfPage.getViewport({ scale: renderScale });

      if (run !== paintRunRef.current) return;

      const cssW = Math.floor(viewport.width / dpr);
      const cssH = Math.floor(viewport.height / dpr);

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const renderTask = pdfPage.render({ canvas, viewport });
      renderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
      } catch (e) {
        if (isRenderingCancelled(e)) return;
        throw e;
      } finally {
        if (renderTaskRef.current === renderTask) renderTaskRef.current = null;
      }

      if (run !== paintRunRef.current) return;

      canvas.style.display = "block";
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.style.maxWidth = "100%";
      canvas.style.borderRadius = "8px";
      canvas.style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)";
      canvas.style.background = "#fff";
      canvas.style.border = "1px solid var(--line-2)";
    },
    [cancelActiveRender],
  );

  useEffect(() => {
    if (!debouncedResume) return;

    const id = ++loadTaskRef.current;
    cancelActiveRender();

    const timer = window.setTimeout(async () => {
      setRendering(true);
      setError(null);
      try {
        const blob = await generatePdfBlob(debouncedResume);
        if (id !== loadTaskRef.current) return;
        const buf = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (id !== loadTaskRef.current) return;
        pdfDocRef.current = doc;
        const np = doc.numPages || 1;
        setNumPages(np);
        setPage((prev) => Math.min(Math.max(1, prev), np));
        setDocGen((g) => g + 1);
      } catch (e) {
        if (id === loadTaskRef.current) setError(e.message || "Render failed");
      } finally {
        if (id === loadTaskRef.current) setRendering(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      if (id === loadTaskRef.current) loadTaskRef.current++;
    };
  }, [debouncedResume, cancelActiveRender]);

  useEffect(() => {
    if (!visible) return;
    const doc = pdfDocRef.current;
    const box = fitBoxRef.current;
    if (!doc || !box) return;

    const run = ++paintRunRef.current;
    setCanvasReady(false);
    setRendering(true);

    (async () => {
      try {
        const p = Math.min(Math.max(1, page), doc.numPages || 1);
        await paintPage(doc, p, box, zoom, run, isMobile);
        if (run === paintRunRef.current) {
          setError(null);
          setCanvasReady(true);
        }
      } catch (e) {
        if (run === paintRunRef.current && !isRenderingCancelled(e)) {
          setError(e.message || "Render failed");
        }
      } finally {
        if (run === paintRunRef.current) setRendering(false);
      }
    })();

    return () => {
      paintRunRef.current++;
      cancelActiveRender();
    };
  }, [visible, page, zoom, fitBoxVersion, docGen, paintPage, cancelActiveRender, isMobile]);

  const z = Math.min(150, Math.max(50, zoom));
  const bump = (delta) => {
    if (!onZoom || isMobile) return;
    onZoom(Math.round(Math.min(150, Math.max(50, z + delta))));
  };

  return (
    <div
      className="resume-preview"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <div
        className="between resume-preview__toolbar"
        style={{
          flexShrink: 0,
          padding: "4px 2px 8px",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div className="center" style={{ gap: 6, flexWrap: "wrap", minWidth: 0 }}>
          {numPages > 1 ? (
            <div role="tablist" aria-label="PDF pages" style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
                const on = page === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setPage(n)}
                    className="btn btn-sm"
                    style={{
                      padding: "4px 10px",
                      minWidth: 32,
                      fontWeight: 700,
                      fontSize: 12,
                      borderRadius: 8,
                      border: on ? "1px solid var(--accent)" : "1px solid var(--line)",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                      color: on ? "var(--accent)" : "var(--ink-2)",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : null}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              background: "color-mix(in srgb, var(--accent-soft) 90%, transparent)",
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
            }}
          >
            ATS-safe
          </span>
        </div>
        {!isMobile ? (
          <div
            className="center"
            style={{
              gap: 2,
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "2px 4px",
              background: "var(--surface)",
            }}
          >
            <button type="button" className="btn btn-quiet btn-sm" style={{ padding: "2px 6px" }} onClick={() => bump(-6)} aria-label="Zoom out">
              −
            </button>
            <span className="mono muted" style={{ fontSize: 11, minWidth: 38, textAlign: "center" }}>
              {z}%
            </span>
            <button type="button" className="btn btn-quiet btn-sm" style={{ padding: "2px 6px" }} onClick={() => bump(6)} aria-label="Zoom in">
              +
            </button>
          </div>
        ) : (
          <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
            Fit to screen
          </span>
        )}
      </div>

      {rendering && visible && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 6,
            zIndex: 3,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          Updating…
        </div>
      )}
      {error && (
        <div
          className="resume-preview__error"
          style={{
            padding: 12,
            background: "#FEE2E2",
            color: "#991B1B",
            borderRadius: 8,
            fontSize: 12,
            width: "100%",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      <div
          ref={viewportRef}
          className="resume-preview__viewport"
          style={{
            flex: 1,
            minHeight: 120,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: isMobile || z <= 100 ? "hidden" : "auto",
            padding: "2px 2px 4px",
          }}
        >
          <div
            className="resume-preview__canvas-wrap"
            style={{
              opacity: visible && canvasReady ? 1 : 0,
              pointerEvents: visible ? "auto" : "none",
            }}
          >
            <canvas ref={canvasRef} />
          </div>
        </div>
    </div>
  );
};
