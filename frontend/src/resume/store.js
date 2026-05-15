import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createDefaultResume, createSectionItem, TEMPLATE_IDS } from "./schema";

/** Merge persisted resumes into the default shape so missing data/design never crashes the UI. */
export function sanitizeResume(raw) {
  const base = createDefaultResume();
  if (!raw || typeof raw !== "object") return base;

  const dataIn = raw.data && typeof raw.data === "object" ? raw.data : {};
  const designIn = raw.design && typeof raw.design === "object" ? raw.design : {};

  const data = {
    ...base.data,
    basics: (() => {
      const merged = {
        ...base.data.basics,
        ...(dataIn.basics && typeof dataIn.basics === "object" ? dataIn.basics : {}),
      };
      if (merged.profileImage && !merged.usePhoto) merged.usePhoto = true;
      if (!merged.usePhoto) merged.profileImage = "";
      return merged;
    })(),
    summary: typeof dataIn.summary === "string" ? dataIn.summary : base.data.summary,
    experience: Array.isArray(dataIn.experience) ? dataIn.experience : base.data.experience,
    education: Array.isArray(dataIn.education) ? dataIn.education : base.data.education,
    skills: Array.isArray(dataIn.skills) ? dataIn.skills : base.data.skills,
    projects: Array.isArray(dataIn.projects) ? dataIn.projects : base.data.projects,
    certifications: Array.isArray(dataIn.certifications) ? dataIn.certifications : base.data.certifications,
    achievements: Array.isArray(dataIn.achievements) ? dataIn.achievements : base.data.achievements,
    languages: Array.isArray(dataIn.languages) ? dataIn.languages : base.data.languages,
    links: Array.isArray(dataIn.links) ? dataIn.links : base.data.links,
    custom: Array.isArray(dataIn.custom) ? dataIn.custom : base.data.custom,
  };

  const design = {
    ...base.design,
    template:
      typeof designIn.template === "string" && TEMPLATE_IDS.includes(designIn.template)
        ? designIn.template
        : base.design.template,
    colors: {
      ...base.design.colors,
      ...(designIn.colors && typeof designIn.colors === "object" ? designIn.colors : {}),
    },
    typography: {
      ...base.design.typography,
      ...(designIn.typography && typeof designIn.typography === "object" ? designIn.typography : {}),
    },
    margins: {
      ...base.design.margins,
      ...(designIn.margins && typeof designIn.margins === "object" ? designIn.margins : {}),
    },
    sectionOrder: Array.isArray(designIn.sectionOrder) ? designIn.sectionOrder : base.design.sectionOrder,
    sectionVisibility: {
      ...base.design.sectionVisibility,
      ...(designIn.sectionVisibility && typeof designIn.sectionVisibility === "object"
        ? designIn.sectionVisibility
        : {}),
    },
  };

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : base.id,
    title: typeof raw.title === "string" ? raw.title : base.title,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    data,
    design,
  };
}

function arrayMove(arr, from, to) {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const useResumeStore = create(
  persist(
    (set, get) => ({
      resumes: [],
      currentId: null,
      past: [],
      future: [],

      _snapshot() {
        const s = get();
        const cur = s.resumes.find((r) => r.id === s.currentId);
        if (!cur) return;
        const snap = JSON.parse(JSON.stringify(sanitizeResume(cur)));
        set({
          past: [...s.past.slice(-29), snap],
          future: [],
        });
      },

      createResume() {
        const r = createDefaultResume();
        set((s) => ({ resumes: [...s.resumes, r], currentId: r.id }));
        return r.id;
      },

      duplicateResume(id) {
        const s = get();
        const src = s.resumes.find((r) => r.id === id);
        if (!src) return;
        const dup = {
          ...JSON.parse(JSON.stringify(src)),
          id: createDefaultResume().id,
          title: src.title + " (copy)",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ resumes: [...s.resumes, dup], currentId: dup.id }));
      },

      deleteResume(id) {
        set((s) => {
          const next = s.resumes.filter((r) => r.id !== id);
          const newCurrent =
            s.currentId === id
              ? next.length > 0
                ? next[0].id
                : null
              : s.currentId;
          return { resumes: next, currentId: newCurrent };
        });
      },

      selectResume(id) {
        set({ currentId: id, past: [], future: [] });
      },

      _updateCurrent(fn) {
        get()._snapshot();
        set((s) => ({
          resumes: s.resumes.map((r) => {
            if (r.id !== s.currentId) return r;
            const updated = fn(r);
            updated.updatedAt = new Date().toISOString();
            return updated;
          }),
        }));
      },

      updateTitle(title) {
        get()._updateCurrent((r) => ({ ...r, title }));
      },

      updateBasics(field, value) {
        get()._updateCurrent((r) => ({
          ...r,
          data: { ...r.data, basics: { ...r.data.basics, [field]: value } },
        }));
      },

      updateSummary(value) {
        get()._updateCurrent((r) => ({
          ...r,
          data: { ...r.data, summary: value },
        }));
      },

      addSectionItem(section) {
        const item = createSectionItem(section);
        get()._updateCurrent((r) => ({
          ...r,
          data: { ...r.data, [section]: [...r.data[section], item] },
        }));
        return item.id;
      },

      updateSectionItem(section, itemId, field, value) {
        get()._updateCurrent((r) => ({
          ...r,
          data: {
            ...r.data,
            [section]: r.data[section].map((it) =>
              it.id === itemId ? { ...it, [field]: value } : it
            ),
          },
        }));
      },

      removeSectionItem(section, itemId) {
        get()._updateCurrent((r) => ({
          ...r,
          data: {
            ...r.data,
            [section]: r.data[section].filter((it) => it.id !== itemId),
          },
        }));
      },

      reorderSectionItems(section, fromIndex, toIndex) {
        get()._updateCurrent((r) => ({
          ...r,
          data: {
            ...r.data,
            [section]: arrayMove(r.data[section], fromIndex, toIndex),
          },
        }));
      },

      updateDesign(path, value) {
        get()._updateCurrent((r) => {
          const design = JSON.parse(JSON.stringify(r.design));
          const parts = path.split(".");
          let obj = design;
          for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
          obj[parts[parts.length - 1]] = value;
          return { ...r, design };
        });
      },

      setSectionOrder(order) {
        get()._updateCurrent((r) => ({
          ...r,
          design: { ...r.design, sectionOrder: order },
        }));
      },

      toggleSectionVisibility(section) {
        get()._updateCurrent((r) => ({
          ...r,
          design: {
            ...r.design,
            sectionVisibility: {
              ...r.design.sectionVisibility,
              [section]: !r.design.sectionVisibility[section],
            },
          },
        }));
      },

      importResumeData(data) {
        const r = createDefaultResume();
        r.data = { ...r.data, ...data };
        r.title = data.basics?.name
          ? `${data.basics.name}'s Resume`
          : "Imported Resume";
        set((s) => ({ resumes: [...s.resumes, r], currentId: r.id }));
        return r.id;
      },

      undo() {
        const s = get();
        if (s.past.length === 0) return;
        const prev = sanitizeResume(s.past[s.past.length - 1]);
        const cur = s.resumes.find((r) => r.id === s.currentId);
        set({
          past: s.past.slice(0, -1),
          future: cur
            ? [...s.future, JSON.parse(JSON.stringify(cur))]
            : s.future,
          resumes: s.resumes.map((r) => (r.id === prev.id ? prev : r)),
        });
      },

      redo() {
        const s = get();
        if (s.future.length === 0) return;
        const next = sanitizeResume(s.future[s.future.length - 1]);
        const cur = s.resumes.find((r) => r.id === s.currentId);
        set({
          future: s.future.slice(0, -1),
          past: cur
            ? [...s.past, JSON.parse(JSON.stringify(cur))]
            : s.past,
          resumes: s.resumes.map((r) => (r.id === next.id ? next : r)),
        });
      },
    }),
    {
      name: "tayyar-resumes",
      partialize: (state) => ({
        resumes: state.resumes,
        currentId: state.currentId,
      }),
      merge: (persistedState, currentState) => {
        const p = persistedState && typeof persistedState === "object" ? persistedState : {};
        const resumesRaw = Array.isArray(p.resumes) ? p.resumes : [];
        const resumes = resumesRaw.map(sanitizeResume);
        let currentId = p.currentId ?? null;
        if (currentId && !resumes.some((r) => r.id === currentId)) {
          currentId = resumes[0]?.id ?? null;
        }
        return {
          ...currentState,
          resumes,
          currentId,
          past: [],
          future: [],
        };
      },
    }
  )
);

export const selectCurrentResume = (s) =>
  s.resumes.find((r) => r.id === s.currentId) || null;
