import React from "react";
import { useResumeStore, selectCurrentResume } from "./store";
import { TEMPLATES, TEMPLATE_META, FONT_OPTIONS, SECTION_TYPES, SECTION_LABELS } from "./schema";
import { TemplateLayoutSkeleton } from "./TemplateSkeletons";
import { Icon } from "../components/ui";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLOR_PRESETS = [
  { label: "Burnt Orange", primary: "#C2410C" },
  { label: "Indigo", primary: "#3730A3" },
  { label: "Emerald", primary: "#047857" },
  { label: "Slate", primary: "#334155" },
  { label: "Rose", primary: "#BE123C" },
  { label: "Violet", primary: "#6D28D9" },
  { label: "Teal", primary: "#0D9488" },
  { label: "Amber", primary: "#B45309" },
];

/* ─── Sortable section row ─── */
const SortableSectionRow = ({ id }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const visible = useResumeStore((s) => selectCurrentResume(s)?.design?.sectionVisibility?.[id] !== false);
  const toggleSectionVisibility = useResumeStore((s) => s.toggleSectionVisibility);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="between"
      role="listitem"
      aria-label={SECTION_LABELS[id]}
    >
      <div className="center" style={{ gap: 6 }}>
        <span {...listeners} style={{ cursor: "grab", color: "var(--ink-4)", touchAction: "none" }}>
          <Icon name="menu" size={12} />
        </span>
        <span style={{ fontSize: 12.5 }}>{SECTION_LABELS[id] || id}</span>
      </div>
      <button
        className="btn btn-quiet btn-sm"
        onClick={() => toggleSectionVisibility(id)}
        title={visible ? "Hide section" : "Show section"}
        style={{ padding: "2px 4px" }}
      >
        <Icon name={visible ? "eye" : "eyeOff"} size={13} style={{ color: visible ? "var(--accent)" : "var(--ink-4)" }} />
      </button>
    </div>
  );
};

/* ─── Main panel ─── */
export const DesignPanel = () => {
  const resume = useResumeStore(selectCurrentResume);
  const updateDesign = useResumeStore((s) => s.updateDesign);
  const setSectionOrder = useResumeStore((s) => s.setSectionOrder);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!resume?.design?.sectionOrder) return null;
  const { design } = resume;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const order = [...design.sectionOrder];
    const from = order.indexOf(active.id);
    const to = order.indexOf(over.id);
    if (from === -1 || to === -1) return;
    order.splice(from, 1);
    order.splice(to, 0, active.id);
    setSectionOrder(order);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "14px 14px 20px", background: "color-mix(in srgb, var(--surface) 90%, #faf7f2)" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--ink-3)", marginBottom: 8 }}>
          TEMPLATE
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {TEMPLATES.map((t) => {
            const meta = TEMPLATE_META[t] || { label: t, desc: "" };
            const sel = design.template === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => updateDesign("template", t)}
                style={{
                  textAlign: "left",
                  padding: 8,
                  borderRadius: 12,
                  cursor: "pointer",
                  border: sel ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: sel ? "var(--accent-soft)" : "var(--surface)",
                  boxShadow: sel ? "0 4px 14px rgba(194,65,12,0.12)" : "0 1px 2px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ pointerEvents: "none" }}>
                  <TemplateLayoutSkeleton variant={t} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{meta.label}</div>
                  <div className="muted" style={{ fontSize: 9.5, marginTop: 2, lineHeight: 1.35 }}>
                    {meta.desc}
                  </div>
                  {sel && (
                    <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: "var(--accent)" }}>Selected</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font */}
      <div style={{ marginBottom: 16 }}>
        <div className="label">Font</div>
        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              className={`btn btn-sm ${design.typography.fontFamily === f.value ? "btn-accent" : "btn-ghost"}`}
              onClick={() => {
                updateDesign("typography.fontFamily", f.value);
                updateDesign("typography.headingFamily", f.heading);
              }}
              style={{ fontFamily: f.value }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div style={{ marginBottom: 16 }}>
        <div className="label">Font Size: {design.typography.fontSize}pt</div>
        <input
          type="range"
          min={8}
          max={14}
          step={0.5}
          value={design.typography.fontSize}
          onChange={(e) => updateDesign("typography.fontSize", parseFloat(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </div>

      {/* Line height */}
      <div style={{ marginBottom: 16 }}>
        <div className="label">Line Height: {design.typography.lineHeight}</div>
        <input
          type="range"
          min={1.0}
          max={2.0}
          step={0.05}
          value={design.typography.lineHeight}
          onChange={(e) => updateDesign("typography.lineHeight", parseFloat(e.target.value))}
          style={{ width: "100%", marginTop: 4 }}
        />
      </div>

      <div className="hr" style={{ margin: "10px 0" }} />

      {/* Colors */}
      <div style={{ marginBottom: 16 }}>
        <div className="label">Accent Color</div>
        <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {COLOR_PRESETS.map((c) => (
            <div
              key={c.primary}
              onClick={() => updateDesign("colors.primary", c.primary)}
              title={c.label}
              style={{
                width: 28, height: 28, borderRadius: 6, cursor: "pointer",
                backgroundColor: c.primary,
                border: design.colors.primary === c.primary ? "3px solid var(--ink)" : "2px solid transparent",
                boxShadow: design.colors.primary === c.primary ? "0 0 0 2px var(--accent-soft)" : "none",
              }}
            />
          ))}
        </div>
        <div className="center" style={{ gap: 6, marginTop: 8 }}>
          <label className="muted" style={{ fontSize: 11 }}>Custom:</label>
          <input
            type="color"
            value={design.colors.primary}
            onChange={(e) => updateDesign("colors.primary", e.target.value)}
            style={{ width: 32, height: 24, border: 0, cursor: "pointer" }}
          />
          <span className="mono muted" style={{ fontSize: 11 }}>{design.colors.primary}</span>
        </div>
      </div>

      <div className="hr" style={{ margin: "10px 0" }} />

      {/* Margins */}
      <div style={{ marginBottom: 16 }}>
        <div className="label">Margins (pt)</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4 }}>
          {["top", "right", "bottom", "left"].map((side) => (
            <div key={side}>
              <label className="muted" style={{ fontSize: 10, textTransform: "capitalize" }}>{side}</label>
              <input
                className="input"
                type="number"
                min={12}
                max={72}
                value={design.margins[side]}
                onChange={(e) => updateDesign(`margins.${side}`, parseInt(e.target.value) || 36)}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="hr" style={{ margin: "10px 0" }} />

      {/* Section order & visibility */}
      <div>
        <div className="label">Section Order & Visibility</div>
        <div className="stack" style={{ gap: 4, marginTop: 6 }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={design.sectionOrder} strategy={verticalListSortingStrategy}>
              {design.sectionOrder.map((s) => (
                <SortableSectionRow key={s} id={s} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
