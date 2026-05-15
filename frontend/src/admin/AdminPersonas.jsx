import React, { useMemo, useState, useEffect, useRef } from "react";
import { Icon, Avatar } from "../components/ui";
import { DEFAULT_AI_INTERVIEWERS } from "../data/aiInterviewers";
import {
  getMergedInterviewers,
  updatePersonaEdit,
  resetPersonaEdit,
  speakPreview,
  stopPreviewSpeech,
  fetchInterviewersFromApi,
  pushInterviewerPatchesToServer,
} from "../lib/aiInterviewerStore";
import { GeminiVoiceSelectOptions } from "../components/GeminiVoiceSelectOptions";

export function AdminPersonas() {
  const [tick, setTick] = useState(0);
  const [voiceStyles, setVoiceStyles] = useState({});
  const [allGeminiVoices, setAllGeminiVoices] = useState([]);
  const list = useMemo(() => getMergedInterviewers(), [tick]);
  const [activeId, setActiveId] = useState(list[0]?.id || "");
  const syncTimer = useRef(null);

  useEffect(() => () => stopPreviewSpeech(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { voiceStyles: vs, allGeminiVoices: all } = await fetchInterviewersFromApi();
        if (!cancelled) {
          setVoiceStyles(vs || {});
          setAllGeminiVoices(Array.isArray(all) ? all : []);
        }
      } catch {
        if (!cancelled) setVoiceStyles({});
      } finally {
        if (!cancelled) setTick((x) => x + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = list.find((r) => r.id === activeId) || list[0];
  const def = DEFAULT_AI_INTERVIEWERS.find((r) => r.id === active?.id);

  const patch = (partial) => {
    if (!active) return;
    updatePersonaEdit(active.id, partial);
    setTick((x) => x + 1);
    const serverFields = [
      "geminiVoice",
      "voiceStyle",
      "displayName",
      "personalityType",
      "oneLiner",
      "title",
      "previewLine",
      "promptAppend",
    ];
    if (!Object.keys(partial).some((k) => serverFields.includes(k))) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      pushInterviewerPatchesToServer({ [active.id]: partial }).catch(() => {});
    }, 700);
  };

  return (
    <div className="stack" style={{ gap: 20, maxWidth: 1100 }}>
      <div>
        <div className="display" style={{ fontSize: 26 }}>AI interview personas</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.55 }}>
          Ten Bible-aligned interviewers (five archetypes × two voices). Text edits stay in this browser; Gemini voice and copy also sync to the server
          (under <span className="mono">data/ai_interviewer_overrides.json</span>) so mock interviews pick them up without clearing localStorage.
          Browser previews use device TTS; the live room uses Google Gemini Live prebuilt voices.
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)", gap: 16, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>
            PERSONAS (10)
          </div>
          <div className="stack" style={{ gap: 0, maxHeight: "min(70vh, 640px)", overflow: "auto" }}>
            {list.map((row) => (
              <button
                key={row.id}
                type="button"
                className="btn btn-ghost"
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  borderRadius: 0,
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--line)",
                  background: row.id === activeId ? "var(--surface-2)" : "transparent",
                  fontWeight: row.id === activeId ? 600 : 500,
                }}
                onClick={() => setActiveId(row.id)}
              >
                <div className="row" style={{ gap: 10, alignItems: "center", width: "100%" }}>
                  <Avatar name={row.displayName} color={row.color} size={36} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{row.displayName}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{row.personalityType}</div>
                  </div>
                  <Icon name="chevR" size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {active && (
          <div className="card" style={{ padding: 22 }}>
            <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <Avatar name={active.displayName} color={active.color} size={48} />
                <div>
                  <div className="display" style={{ fontSize: 20 }}>{active.displayName}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {active.personalityType} · {active.title} · {active.experienceBand}
                  </div>
                </div>
              </div>
              <span className="mono muted" style={{ fontSize: 11 }}>{active.baseKey}</span>
            </div>

            <div className="label" style={{ marginTop: 18 }}>Gemini Live voice (prebuilt)</div>
            <select
              className="input"
              style={{ width: "100%", fontSize: 13 }}
              value={active.geminiVoice || "Kore"}
              onChange={(e) => patch({ geminiVoice: e.target.value })}
            >
              <GeminiVoiceSelectOptions
                voiceStyles={voiceStyles}
                allGeminiVoices={allGeminiVoices}
                fallbackValue={active.geminiVoice || "Kore"}
              />
            </select>
            <div className="muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>
              Indian English delivery is steered in the Live system prompt; this field chooses synthesis timbre. Default for this row:{" "}
              <span className="mono">{def?.geminiVoice || "—"}</span>
            </div>

            <div className="label" style={{ marginTop: 14 }}>Display name</div>
            <input
              className="input"
              style={{ width: "100%" }}
              value={active.displayName}
              onChange={(e) => patch({ displayName: e.target.value })}
            />

            <div className="label" style={{ marginTop: 14 }}>Personality type (shown to candidates)</div>
            <input
              className="input"
              style={{ width: "100%" }}
              value={active.personalityType}
              onChange={(e) => patch({ personalityType: e.target.value })}
            />

            <div className="label" style={{ marginTop: 14 }}>One-liner</div>
            <input
              className="input"
              style={{ width: "100%" }}
              value={active.oneLiner}
              onChange={(e) => patch({ oneLiner: e.target.value })}
            />

            <div className="label" style={{ marginTop: 14 }}>Role title</div>
            <input
              className="input"
              style={{ width: "100%" }}
              value={active.title}
              onChange={(e) => patch({ title: e.target.value })}
            />

            <div className="label" style={{ marginTop: 14 }}>Preview script (for TTS)</div>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 88, resize: "vertical", fontFamily: "var(--f-body)" }}
              value={active.previewLine}
              onChange={(e) => patch({ previewLine: e.target.value })}
            />

            <div className="label" style={{ marginTop: 14 }}>Extra instructions for the model (optional)</div>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 72, resize: "vertical", fontFamily: "var(--f-body)" }}
              placeholder="Appended to the session system prompt as product overrides."
              value={active.promptAppend || ""}
              onChange={(e) => patch({ promptAppend: e.target.value })}
            />

            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => speakPreview(
                  active.previewLine,
                  active.gender,
                  "interviewer",
                  list.findIndex((r) => r.id === active.id),
                )}
              >
                <Icon name="play" size={14} /> Preview AI voice
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => speakPreview(
                  "Hi, I'm the candidate. I'm a bit nervous but prepared — here's how I'd summarize my last project in one minute.",
                  active.gender === "female" ? "male" : "female",
                  "candidate",
                )}
              >
                <Icon name="play" size={14} /> Preview user (sample)
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => stopPreviewSpeech()}>
                <Icon name="stop" size={14} /> Stop
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  resetPersonaEdit(active.id);
                  setTick((x) => x + 1);
                }}
              >
                Reset this persona
              </button>
            </div>

            <div className="hr" style={{ margin: "18px 0" }} />

            <div className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>
              Backend key <span className="mono">{active.baseKey}</span> selects the Personality Bible block; gender matches the male/female variant.
              Session rounds still use the same five-phase flow — this choice mainly steers voice, name, and character.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
