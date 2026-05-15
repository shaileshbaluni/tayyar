import { create } from "zustand";
import { fetchLivePromptCatalog } from "./fetchLivePromptCatalog";
import { SEED_PROMPTS_BY_CATEGORY, FEATURE_CATEGORIES } from "./mockAdminData";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function firstSelection(promptsByCategory, categories) {
  const cat = categories[0] || FEATURE_CATEGORIES[0];
  const list = promptsByCategory[cat] || [];
  const p = list[0];
  return { cat, p };
}

const fallbackSeeds = clone(SEED_PROMPTS_BY_CATEGORY);
const { cat: initCat, p: initPrompt } = firstSelection(fallbackSeeds, FEATURE_CATEGORIES);

export const usePromptStudioStore = create((set, get) => ({
  categories: FEATURE_CATEGORIES,
  selectedCategory: initCat,
  promptsByCategory: fallbackSeeds,
  selectedPromptId: initPrompt?.id ?? null,
  editorDraft: initPrompt?.content ?? "",
  catalogMeta: null,
  catalogLoading: false,
  catalogError: null,
  localOverrides: {},

  sandboxInputs: {
    resume: "2 YOE SDE — payments, Node, Postgres.",
    role: "SDE II",
    company: "TCS",
    interviewType: "Technical",
    experienceLevel: "Mid",
  },
  sandboxOutput: "",

  loadLiveCatalog: async () => {
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await fetchLivePromptCatalog();
      const categories = catalog.categories?.length ? catalog.categories : FEATURE_CATEGORIES;
      const promptsByCategory = catalog.promptsByCategory || {};
      const { cat, p } = firstSelection(promptsByCategory, categories);
      set({
        categories,
        promptsByCategory,
        selectedCategory: cat,
        selectedPromptId: p?.id ?? null,
        editorDraft: p?.content ?? "",
        catalogMeta: {
          generatedAt: catalog.generatedAt,
          source: catalog.source,
          totalPrompts: catalog.totalPrompts,
        },
        catalogLoading: false,
        localOverrides: {},
      });
    } catch (e) {
      set({
        catalogLoading: false,
        catalogError: e?.message || "Could not load live prompt catalog",
      });
    }
  },

  setCategory: (c) => {
    const list = get().promptsByCategory[c] ?? [];
    const p = list[0];
    set({
      selectedCategory: c,
      selectedPromptId: p?.id ?? null,
      editorDraft: p?.content ?? "",
    });
  },

  selectPrompt: (id) => {
    const { promptsByCategory, selectedCategory, localOverrides } = get();
    const list = promptsByCategory[selectedCategory] ?? [];
    const p = list.find((x) => x.id === id);
    const content = localOverrides[id] ?? p?.content ?? "";
    set({ selectedPromptId: id, editorDraft: content });
  },

  setEditorDraft: (s) => set({ editorDraft: s }),

  updatePromptContent: (id, content) =>
    set((s) => {
      const overrides = { ...s.localOverrides, [id]: content };
      const cat = s.selectedCategory;
      const list = [...(s.promptsByCategory[cat] ?? [])];
      const i = list.findIndex((p) => p.id === id);
      if (i === -1) return { localOverrides: overrides, editorDraft: s.selectedPromptId === id ? content : s.editorDraft };
      const prev = list[i];
      list[i] = {
        ...prev,
        content,
        updatedAt: new Date().toISOString(),
        version: (prev.version || 1) + 1,
        localOverride: true,
        readOnly: false,
      };
      return {
        localOverrides: overrides,
        promptsByCategory: { ...s.promptsByCategory, [cat]: list },
        editorDraft: s.selectedPromptId === id ? content : s.editorDraft,
      };
    }),

  setSandboxField: (key, value) =>
    set((s) => ({
      sandboxInputs: { ...s.sandboxInputs, [key]: value },
    })),

  setSandboxOutput: (sandboxOutput) => set({ sandboxOutput }),

  restoreDefault: (id) =>
    set((s) => {
      const { localOverrides, promptsByCategory, selectedCategory } = s;
      const nextOverrides = { ...localOverrides };
      delete nextOverrides[id];
      const list = (promptsByCategory[selectedCategory] ?? []).map((p) => {
        if (p.id !== id) return p;
        const orig = p.versions?.[0]?.content ?? p.content;
        return {
          ...p,
          content: orig,
          localOverride: false,
          readOnly: p.syncedFromCode ?? true,
          version: (p.version || 1) + 1,
        };
      });
      const p = list.find((x) => x.id === id);
      return {
        localOverrides: nextOverrides,
        promptsByCategory: { ...promptsByCategory, [selectedCategory]: list },
        editorDraft: s.selectedPromptId === id && p ? p.content : s.editorDraft,
      };
    }),

  duplicatePrompt: (id) =>
    set((s) => {
      const cat = s.selectedCategory;
      const list = [...(s.promptsByCategory[cat] ?? [])];
      const p = list.find((x) => x.id === id);
      if (!p) return s;
      const copy = {
        ...p,
        id: `${id}_copy_${Date.now()}`,
        name: `${p.name} (copy)`,
        version: 1,
        usageCount: 0,
        readOnly: false,
        syncedFromCode: false,
        localOverride: true,
      };
      return {
        promptsByCategory: { ...s.promptsByCategory, [cat]: [...list, copy] },
        selectedPromptId: copy.id,
        editorDraft: copy.content,
      };
    }),

  rollbackVersion: (id, versionId) =>
    set((s) => {
      const cat = s.selectedCategory;
      const list = (s.promptsByCategory[cat] ?? []).map((p) => {
        if (p.id !== id) return p;
        const v = p.versions?.find((x) => x.id === versionId);
        if (!v) return p;
        return { ...p, content: v.content, version: (p.version || 1) + 1, localOverride: true };
      });
      const p = list.find((x) => x.id === id);
      return {
        promptsByCategory: { ...s.promptsByCategory, [cat]: list },
        editorDraft: s.selectedPromptId === id && p ? p.content : s.editorDraft,
      };
    }),

  deletePrompt: (id) =>
    set((s) => {
      const cat = s.selectedCategory;
      const p = (s.promptsByCategory[cat] ?? []).find((x) => x.id === id);
      if (p?.syncedFromCode) return s;
      const list = (s.promptsByCategory[cat] ?? []).filter((p) => p.id !== id);
      const nextId = list[0]?.id ?? null;
      const nextContent = list[0]?.content ?? "";
      return {
        promptsByCategory: { ...s.promptsByCategory, [cat]: list },
        selectedPromptId: s.selectedPromptId === id ? nextId : s.selectedPromptId,
        editorDraft: s.selectedPromptId === id ? nextContent : s.editorDraft,
      };
    }),
}));
