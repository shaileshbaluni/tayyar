import React, { useEffect, useState } from "react";
import { Icon } from "../components/ui";
import { usePromptStudioStore } from "./promptStudioStore";

function injectVars(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

function MetaRow({ label, children }) {
  return (
    <div className="stack" style={{ gap: 4, marginBottom: 10 }}>
      <span className="muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </span>
      <div style={{ fontSize: 12, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

export function AdminPromptStudio() {
  const {
    categories,
    selectedCategory,
    promptsByCategory,
    selectedPromptId,
    editorDraft,
    sandboxInputs,
    sandboxOutput,
    catalogMeta,
    catalogLoading,
    catalogError,
    loadLiveCatalog,
    setCategory,
    selectPrompt,
    setEditorDraft,
    updatePromptContent,
    setSandboxField,
    setSandboxOutput,
    restoreDefault,
    duplicatePrompt,
    rollbackVersion,
    deletePrompt,
  } = usePromptStudioStore();

  const prompts = promptsByCategory[selectedCategory] ?? [];
  const selected = prompts.find((p) => p.id === selectedPromptId) ?? null;
  const [tab, setTab] = useState("edit");

  useEffect(() => {
    loadLiveCatalog();
  }, [loadLiveCatalog]);

  const runSandbox = () => {
    if (!selected) return;
    const vars = { ...sandboxInputs };
    selected.variables.forEach((v) => {
      if (!vars[v]) vars[v] = `[${v}]`;
    });
    const filled = injectVars(editorDraft, vars);
    const mock = `--- Mock output (${estimateTokens(filled)} est. tokens) ---\n\n${filled.slice(0, 1200)}${filled.length > 1200 ? "\n…" : ""}`;
    setSandboxOutput(mock);
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="display" style={{ fontSize: 26 }}>
            Prompt Studio
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 640, lineHeight: 1.5 }}>
            Live sync from production code — every prompt currently used across features, including the Session Context Engine
            (steps 1–6 briefing), personas, Gemini Live rules, scorecard, resume, LinkedIn, and salary flows.
          </div>
          {catalogMeta && (
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              {catalogMeta.totalPrompts} prompts · source: {catalogMeta.source} · updated{" "}
              {new Date(catalogMeta.generatedAt).toLocaleString()}
            </div>
          )}
          {catalogError && (
            <div style={{ fontSize: 12, color: "var(--bad)", marginTop: 8 }}>{catalogError}</div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={catalogLoading}
          onClick={() => loadLiveCatalog()}
        >
          <Icon name="refresh" size={14} /> {catalogLoading ? "Syncing…" : "Refresh from code"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 1fr",
          gap: 16,
          alignItems: "stretch",
          minHeight: "calc(100vh - 180px)",
        }}
        className="admin-prompt-grid"
      >
        <div className="card" style={{ padding: 8, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "8px 10px" }}>
            FEATURES
          </div>
          <div className="stack" style={{ gap: 2, overflow: "auto", flex: 1 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`btn btn-ghost btn-sm ${cat === selectedCategory ? "btn-primary" : ""}`}
                style={{ justifyContent: "flex-start", textAlign: "left", whiteSpace: "normal", height: "auto", padding: "8px 10px" }}
                onClick={() => setCategory(cat)}
              >
                <span>{cat}</span>
                <span className="mono muted" style={{ fontSize: 10, marginLeft: 6 }}>
                  ({(promptsByCategory[cat] || []).length})
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            PROMPTS · {selectedCategory}
          </div>
          <div className="stack" style={{ gap: 8, padding: 8, overflow: "auto", flex: 1 }}>
            {prompts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="card"
                style={{
                  padding: 12,
                  textAlign: "left",
                  cursor: "pointer",
                  border: p.id === selectedPromptId ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: p.id === selectedPromptId ? "var(--accent-soft)" : "var(--surface)",
                }}
                onClick={() => selectPrompt(p.id)}
              >
                <div className="between" style={{ alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                    {p.syncedFromCode && (
                      <span className="chip" style={{ fontSize: 9 }} title="Synced from codebase">
                        LIVE
                      </span>
                    )}
                    {p.localOverride && (
                      <span className="chip chip-warn" style={{ fontSize: 9 }}>
                        edited
                      </span>
                    )}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.35 }}>
                  {p.description}
                </div>
                {p.sourceFile && (
                  <div className="mono muted" style={{ fontSize: 9, marginTop: 6, wordBreak: "break-all" }}>
                    {p.sourceFile}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="stack" style={{ gap: 12, minHeight: 0 }}>
          <div className="card" style={{ padding: 0, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="between" style={{ flexWrap: "wrap", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--line)" }}>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {["edit", "meta", "versions", "deps"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setTab(t)}
                  >
                    {t === "meta" ? "Details" : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  disabled={!selected}
                  onClick={() => selected && updatePromptContent(selected.id, editorDraft)}
                >
                  Save (local)
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!selected} onClick={() => selected && restoreDefault(selected.id)}>
                  Restore
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!selected} onClick={() => selected && duplicatePrompt(selected.id)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!selected || selected.syncedFromCode}
                  onClick={() => selected && deletePrompt(selected.id)}
                  title={selected?.syncedFromCode ? "Cannot delete code-synced prompts" : ""}
                >
                  Delete
                </button>
              </div>
            </div>

            {tab === "edit" && (
              <div className="stack" style={{ gap: 10, padding: 12, flex: 1, minHeight: 0 }}>
                {selected?.variables?.length ? (
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {selected.variables.map((v) => (
                      <span key={v} className="chip mono" style={{ fontSize: 10 }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                ) : null}
                <textarea
                  className="input"
                  style={{ flex: 1, minHeight: 220, fontFamily: "var(--f-mono)", fontSize: 12, lineHeight: 1.45, resize: "vertical" }}
                  value={editorDraft}
                  onChange={(e) => setEditorDraft(e.target.value)}
                  spellCheck={false}
                  readOnly={selected?.readOnly && !selected?.localOverride}
                />
                <div className="muted" style={{ fontSize: 11 }}>
                  Est. tokens {estimateTokens(editorDraft).toLocaleString()}
                  {selected?.syncedFromCode && (
                    <span> · Edits here are local only — change production code and click Refresh from code</span>
                  )}
                </div>
              </div>
            )}

            {tab === "meta" && selected && (
              <div style={{ padding: 12, overflow: "auto", flex: 1 }}>
                <MetaRow label="Prompt ID">
                  <span className="mono">{selected.id}</span>
                </MetaRow>
                <MetaRow label="Pipeline">{selected.pipeline || "—"}</MetaRow>
                <MetaRow label="When used">{selected.whenUsed || "—"}</MetaRow>
                <MetaRow label="Source file">
                  <span className="mono" style={{ wordBreak: "break-all" }}>
                    {selected.sourceFile || "—"}
                  </span>
                </MetaRow>
                <MetaRow label="Symbol">{selected.sourceSymbol || "—"}</MetaRow>
                <MetaRow label="Tags">
                  {(selected.tags || []).length ? selected.tags.join(", ") : "—"}
                </MetaRow>
                {selected.composedFrom?.length > 0 && (
                  <MetaRow label="Composed from (upstream)">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {selected.composedFrom.map((id) => (
                        <li key={id} className="mono" style={{ fontSize: 11 }}>
                          {id}
                        </li>
                      ))}
                    </ul>
                  </MetaRow>
                )}
              </div>
            )}

            {tab === "versions" && selected && (
              <div className="stack" style={{ gap: 8, padding: 12, overflow: "auto" }}>
                {(selected.versions || []).map((v) => (
                  <div key={v.id} className="card between" style={{ padding: 10 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>v{v.version}</span>
                      <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                        {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => rollbackVersion(selected.id, v.id)}>
                      Rollback
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === "deps" && (
              <div style={{ padding: 12, fontSize: 13 }} className="muted">
                {selected?.dependsOn?.length ? (
                  <ul>
                    {selected.dependsOn.map((id) => (
                      <li key={id} className="mono">
                        {id}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No upstream dependencies listed.</p>
                )}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Prompt testing sandbox</div>
            <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>
              Fills {"{{variables}}"} in the editor text — does not call Gemini.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["resume", "Resume snippet"],
                ["role", "Role"],
                ["company", "Company"],
                ["interviewType", "Interview type"],
                ["experienceLevel", "Experience level"],
              ].map(([key, label]) => (
                <label key={key} className="stack" style={{ gap: 4, fontSize: 11 }}>
                  <span className="muted">{label}</span>
                  <input className="input" value={sandboxInputs[key] ?? ""} onChange={(e) => setSandboxField(key, e.target.value)} />
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={runSandbox}>
              <Icon name="play" size={14} /> Run (mock)
            </button>
            {sandboxOutput && (
              <pre
                className="mono"
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  fontSize: 11,
                  maxHeight: 160,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {sandboxOutput}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

