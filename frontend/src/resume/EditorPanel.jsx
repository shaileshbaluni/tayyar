import React, { useEffect, useMemo, useRef, useState } from "react";
import { fileToProfileDataUrl } from "./profileImageUtils";
import { useResumeStore, selectCurrentResume } from "./store";
import { SECTION_TYPES, SECTION_LABELS, SECTION_ICONS, itemDisplayTitle, itemDisplaySubtitle } from "./schema";
import { Icon } from "../components/ui";
import { useIsMobile } from "../hooks/useIsMobile";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BASICS_TAB = "basics";

/* ─── Profile photo ─── */
const ProfilePhotoEditor = () => {
  const basics = useResumeStore((s) => selectCurrentResume(s)?.data?.basics);
  const updateBasics = useResumeStore((s) => s.updateBasics);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);

  if (!basics) return null;

  const usePhoto = Boolean(basics.usePhoto);
  const hasImage = Boolean(basics.profileImage);

  const setMode = (withPhoto) => {
    setUploadErr(null);
    if (!withPhoto) {
      updateBasics("usePhoto", false);
      updateBasics("profileImage", "");
      return;
    }
    updateBasics("usePhoto", true);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const dataUrl = await fileToProfileDataUrl(file);
      updateBasics("usePhoto", true);
      updateBasics("profileImage", dataUrl);
    } catch (err) {
      setUploadErr(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="resume-profile-photo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <span className="label" style={{ fontSize: 10.5, marginBottom: 6, display: "block" }}>
          Profile photo
        </span>
        <div
          role="group"
          aria-label="Profile photo mode"
          style={{
            display: "inline-flex",
            padding: 3,
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            gap: 2,
          }}
        >
          {[
            { key: false, label: "No photo" },
            { key: true, label: "With photo" },
          ].map((opt) => {
            const on = usePhoto === opt.key;
            return (
              <button
                key={String(opt.key)}
                type="button"
                aria-pressed={on}
                onClick={() => setMode(opt.key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  background: on ? "var(--surface)" : "transparent",
                  color: on ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: on ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {usePhoto && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px dashed var(--line)",
            background: "var(--surface)",
          }}
        >
          {hasImage ? (
            <img
              src={basics.profileImage}
              alt="Profile"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--line)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="user" size={28} style={{ color: "var(--ink-4)" }} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
            <button
              type="button"
              className="btn btn-sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : hasImage ? "Change photo" : "Upload photo"}
            </button>
            {hasImage && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => updateBasics("profileImage", "")}
              >
                Remove photo
              </button>
            )}
            <span className="muted" style={{ fontSize: 10, lineHeight: 1.35 }}>
              JPEG or PNG, max 8 MB. Shown on your resume per template layout.
            </span>
            {uploadErr && (
              <span style={{ fontSize: 10, color: "#991b1b" }}>{uploadErr}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Basics ─── */
const BasicsEditor = () => {
  const basics = useResumeStore((s) => selectCurrentResume(s)?.data?.basics);
  const updateBasics = useResumeStore((s) => s.updateBasics);
  if (!basics) return null;

  const fields = [
    { key: "name", label: "Full Name", ph: "Rahul Sharma", wide: true },
    { key: "headline", label: "Headline", ph: "Software Engineer", wide: true },
    { key: "email", label: "Email", ph: "rahul@example.com" },
    { key: "phone", label: "Phone", ph: "+91 98765 43210" },
    { key: "location", label: "Location", ph: "Bengaluru, India" },
    { key: "website", label: "Website", ph: "https://rahul.dev" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px 10px",
        alignContent: "start",
      }}
    >
      {fields.map((f) => (
        <div key={f.key} style={{ gridColumn: f.wide ? "1 / -1" : undefined }}>
          <label className="label" style={{ fontSize: 10.5, marginBottom: 2 }}>
            {f.label}
          </label>
          <input
            className="input"
            value={basics[f.key] || ""}
            placeholder={f.ph}
            onChange={(e) => updateBasics(f.key, e.target.value)}
            style={{ padding: "6px 8px", fontSize: 13 }}
          />
        </div>
      ))}
    </div>
  );
};

/* ─── Summary (hints, for accordion body) ─── */
const SummaryEditor = () => {
  const summary = useResumeStore((s) => selectCurrentResume(s)?.data?.summary);
  const updateSummary = useResumeStore((s) => s.updateSummary);
  const text = summary || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const strongVerbs = /\b(achieved|delivered|built|led|reduced|improved|scaled|launched|designed|owned|shipped|optimized)\b/i.test(text);
  const secondPerson = /\b(you|your|yours)\b/i.test(text);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
          Professional summary
        </span>
        <button type="button" className="btn btn-ghost btn-sm" disabled title="Coming soon" style={{ opacity: 0.65 }}>
          Rewrite with AI
        </button>
      </div>
      <textarea
        className="input"
        rows={5}
        value={text}
        placeholder="Lead with impact: scope, metrics, and what you shipped — in your own voice."
        onChange={(e) => updateSummary(e.target.value)}
        style={{ resize: "vertical", padding: "10px 12px", fontSize: 13, lineHeight: 1.45 }}
      />
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="center" style={{ gap: 6, flexWrap: "wrap" }}>
          {strongVerbs && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "#DCFCE7", color: "#166534" }}>
              Strong verbs
            </span>
          )}
          {secondPerson && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "#FFEDD5", color: "#9A3412" }}>
              2nd person — try rewording
            </span>
          )}
          {!strongVerbs && !secondPerson && text.length > 0 && (
            <span className="muted" style={{ fontSize: 10 }}>
              Add metrics and action verbs for a stronger signal.
            </span>
          )}
        </div>
        <span className="muted mono" style={{ fontSize: 10 }}>
          {words} words · {chars} chars
        </span>
      </div>
    </div>
  );
};

/* ─── Generic field renderers by section ─── */
function sectionFields(section) {
  switch (section) {
    case "experience":
      return [
        { key: "position", label: "Position", ph: "Software Engineer", half: true },
        { key: "company", label: "Company", ph: "TCS", half: true },
        { key: "location", label: "Location", ph: "Mumbai", half: true },
        { key: "startDate", label: "Start", ph: "2022-06", type: "month", half: true },
        { key: "endDate", label: "End", ph: "2024-01", type: "month", hideIf: "current", half: true },
        { key: "current", label: "Currently here", type: "checkbox" },
        { key: "description", label: "Description (one bullet per line)", type: "textarea", ph: "- Built REST APIs…", wide: true },
      ];
    case "education":
      return [
        { key: "degree", label: "Degree", ph: "B.Tech", half: true },
        { key: "area", label: "Field of study", ph: "Computer Science", half: true },
        { key: "school", label: "Institution", ph: "IIT Delhi", wide: true },
        { key: "grade", label: "Grade / GPA", ph: "8.5 CGPA", half: true },
        { key: "startDate", label: "Start", ph: "2019-08", type: "month", half: true },
        { key: "endDate", label: "End", ph: "2023-06", type: "month", half: true },
        { key: "description", label: "Description", type: "textarea", ph: "Coursework, thesis…", wide: true },
      ];
    case "skills":
      return [
        { key: "name", label: "Skill", ph: "React", half: true },
        { key: "level", label: "Level (1–5)", type: "range", min: 1, max: 5, half: true },
        { key: "keywords", label: "Keywords (comma-separated)", ph: "hooks, context", type: "keywords", wide: true },
      ];
    case "projects":
      return [
        { key: "name", label: "Project", ph: "E-commerce Platform", wide: true },
        { key: "website", label: "URL", ph: "https://github.com/…", wide: true },
        { key: "startDate", label: "Start", ph: "2023-01", type: "month", half: true },
        { key: "endDate", label: "End", ph: "2023-06", type: "month", half: true },
        { key: "description", label: "Description", type: "textarea", ph: "- Built…", wide: true },
      ];
    case "certifications":
      return [
        { key: "title", label: "Title", ph: "AWS Solutions Architect", wide: true },
        { key: "issuer", label: "Issuer", ph: "Amazon Web Services", half: true },
        { key: "date", label: "Date", ph: "2023-09", type: "month", half: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
      ];
    case "achievements":
      return [
        { key: "title", label: "Title", ph: "Hackathon Winner", half: true },
        { key: "date", label: "Date", ph: "2023-03", type: "month", half: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
      ];
    case "languages":
      return [
        { key: "language", label: "Language", ph: "Hindi", half: true },
        { key: "level", label: "Proficiency (1–5)", type: "range", min: 1, max: 5, half: true },
      ];
    case "links":
      return [
        { key: "network", label: "Network", ph: "LinkedIn", half: true },
        { key: "username", label: "Username", ph: "rahulsharma", half: true },
        { key: "url", label: "URL", ph: "https://linkedin.com/in/…", wide: true },
      ];
    default:
      return [];
  }
}

const LEVEL_LABELS = ["Beginner", "Elementary", "Intermediate", "Advanced", "Native"];

const ItemField = ({ field, item, section, itemId }) => {
  const updateSectionItem = useResumeStore((s) => s.updateSectionItem);

  if (field.hideIf && item[field.hideIf]) return null;

  const wrapStyle = {
    gridColumn: field.wide ? "1 / -1" : field.half ? "span 1" : "1 / -1",
  };

  if (field.type === "checkbox") {
    return (
      <label
        className="center"
        style={{
          ...wrapStyle,
          gap: 6,
          fontSize: 12,
          cursor: "pointer",
          padding: "4px 0",
          gridColumn: "1 / -1",
        }}
      >
        <input
          type="checkbox"
          checked={!!item[field.key]}
          onChange={(e) => updateSectionItem(section, itemId, field.key, e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "range") {
    return (
      <div style={wrapStyle}>
        <label className="label" style={{ fontSize: 10.5, marginBottom: 2 }}>
          {field.label}: {LEVEL_LABELS[item[field.key] - 1] || item[field.key]}
        </label>
        <input
          type="range"
          min={field.min}
          max={field.max}
          value={item[field.key] || field.min}
          onChange={(e) => updateSectionItem(section, itemId, field.key, parseInt(e.target.value, 10))}
          style={{ width: "100%" }}
        />
      </div>
    );
  }

  if (field.type === "keywords") {
    return (
      <div style={wrapStyle}>
        <label className="label" style={{ fontSize: 10.5, marginBottom: 2 }}>
          {field.label}
        </label>
        <input
          className="input"
          value={(item[field.key] || []).join(", ")}
          placeholder={field.ph}
          onChange={(e) =>
            updateSectionItem(
              section,
              itemId,
              field.key,
              e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
            )
          }
          style={{ padding: "6px 8px", fontSize: 13 }}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div style={wrapStyle}>
        <label className="label" style={{ fontSize: 10.5, marginBottom: 2 }}>
          {field.label}
        </label>
        <textarea
          className="input"
          rows={2}
          value={item[field.key] || ""}
          placeholder={field.ph}
          onChange={(e) => updateSectionItem(section, itemId, field.key, e.target.value)}
          style={{ resize: "vertical", padding: "6px 8px", fontSize: 13, lineHeight: 1.4 }}
        />
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <label className="label" style={{ fontSize: 10.5, marginBottom: 2 }}>
        {field.label}
      </label>
      <input
        className="input"
        type={field.type === "month" ? "month" : "text"}
        value={item[field.key] || ""}
        placeholder={field.ph}
        onChange={(e) => updateSectionItem(section, itemId, field.key, e.target.value)}
        style={{ padding: "6px 8px", fontSize: 13 }}
      />
    </div>
  );
};

/* ─── Sortable item row ─── */
const SortableItem = ({ id, section, item, expanded, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const removeSectionItem = useResumeStore((s) => s.removeSectionItem);
  const fields = sectionFields(section);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="card" {...attributes}>
      <div className="between" style={{ padding: "6px 8px", cursor: "pointer" }} onClick={onToggle}>
        <div className="center" style={{ gap: 6, minWidth: 0 }}>
          <span {...listeners} style={{ cursor: "grab", color: "var(--ink-4)", touchAction: "none", flexShrink: 0 }}>
            <Icon name="menu" size={13} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {itemDisplayTitle(section, item)}
            </div>
            <div className="muted" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {itemDisplaySubtitle(section, item)}
            </div>
          </div>
        </div>
        <div className="center" style={{ gap: 2, flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              removeSectionItem(section, item.id);
            }}
            title="Remove"
            style={{ padding: "2px 4px" }}
          >
            <Icon name="x" size={12} />
          </button>
          <Icon name={expanded ? "chevD" : "chevR"} size={13} style={{ color: "var(--ink-4)" }} />
        </div>
      </div>

      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 8px",
            padding: "4px 8px 10px",
            borderTop: "1px solid var(--line)",
            background: "color-mix(in srgb, var(--surface-2) 55%, transparent)",
          }}
        >
          {fields.map((f) => (
            <ItemField key={f.key} field={f} item={item} section={section} itemId={item.id} />
          ))}
        </div>
      )}
    </div>
  );
};

const EMPTY_ITEMS = [];

const SectionListEditor = ({ section }) => {
  const items = useResumeStore((s) => {
    const raw = selectCurrentResume(s)?.data?.[section];
    return Array.isArray(raw) ? raw : EMPTY_ITEMS;
  });
  const addSectionItem = useResumeStore((s) => s.addSectionItem);
  const reorderSectionItems = useResumeStore((s) => s.reorderSectionItems);
  const [expandedId, setExpandedId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from !== -1 && to !== -1) reorderSectionItems(section, from, to);
  };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="between" style={{ alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 11 }}>
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const id = addSectionItem(section);
            setExpandedId(id);
          }}
          style={{ padding: "4px 8px" }}
        >
          <Icon name="plus" size={11} /> Add to {SECTION_LABELS[section] || section}
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="stack" style={{ gap: 5 }}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                id={item.id}
                section={section}
                item={item}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

const PersonalSectionBody = () => {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="center" style={{ gap: 5 }}>
          <Icon name="user" size={13} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Contact & headline</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled title="Coming soon" style={{ opacity: 0.65 }}>
          Import from LinkedIn
        </button>
      </div>
      <ProfilePhotoEditor />
      <BasicsEditor />
    </div>
  );
};

function SectionAccordionBody({ sectionKey }) {
  if (sectionKey === BASICS_TAB) return <PersonalSectionBody />;
  if (sectionKey === "summary") return <SummaryEditor />;
  return <SectionListEditor section={sectionKey} />;
}

/* ─── Main panel: vertical exclusive accordion ─── */
export const EditorPanel = () => {
  const resume = useResumeStore(selectCurrentResume);
  const sectionOrder = resume?.design?.sectionOrder || SECTION_TYPES;
  const isMobile = useIsMobile();

  const sections = useMemo(
    () => [
      { key: BASICS_TAB, label: "Personal", icon: "user" },
      ...sectionOrder.map((s) => ({
        key: s,
        label: SECTION_LABELS[s] || s,
        icon: SECTION_ICONS[s] || "edit",
      })),
    ],
    [sectionOrder],
  );

  const [openSection, setOpenSection] = useState(BASICS_TAB);
  const [mobileSection, setMobileSection] = useState(BASICS_TAB);

  useEffect(() => {
    setOpenSection(BASICS_TAB);
    setMobileSection(BASICS_TAB);
  }, [resume?.id]);

  const openAccordion = (key) => {
    setOpenSection((prev) => (prev === key ? prev : key));
  };

  if (!resume) return null;

  if (isMobile) {
    return (
      <div className="resume-editor-panel resume-editor-panel--mobile">
        <div className="resume-editor-panel__section-nav" role="tablist" aria-label="Resume sections">
          {sections.map((s) => {
            const active = mobileSection === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={"resume-editor-panel__section-tab" + (active ? " is-active" : "")}
                onClick={() => setMobileSection(s.key)}
              >
                <Icon name={s.icon} size={12} />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="resume-editor-panel__section-body">
          <SectionAccordionBody sectionKey={mobileSection} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "color-mix(in srgb, var(--bg) 70%, #faf7f2)",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 10px 16px" }}>
        {sections.map((s) => {
          const open = openSection === s.key;
          return (
            <div
              key={s.key}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                marginBottom: 8,
                overflow: "hidden",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <button
                type="button"
                onClick={() => openAccordion(s.key)}
                className="between"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  background: open ? "color-mix(in srgb, var(--accent-soft) 50%, var(--surface))" : "var(--surface)",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div className="center" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                  <Icon name={s.icon} size={14} style={{ color: open ? "var(--accent)" : "var(--ink-3)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>{s.label}</span>
                </div>
                <Icon name={open ? "chevD" : "chevR"} size={14} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
              </button>
              {open && (
                <div
                  style={{
                    borderTop: "1px solid var(--line)",
                    padding: "12px 12px 14px",
                    background: "color-mix(in srgb, var(--surface-2) 22%, var(--surface))",
                  }}
                >
                  <SectionAccordionBody sectionKey={s.key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
