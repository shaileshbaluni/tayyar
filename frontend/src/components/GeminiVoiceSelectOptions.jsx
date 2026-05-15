import React from "react";

/** Labels for `voiceStyles` keys from GET /api/v1/ai-interviewers */
export const VOICE_STYLE_LABELS = {
  firm_professional: "Firm / professional",
  informative_clear: "Informative / clear",
  friendly_warm: "Friendly / warm",
  mature_gravelly: "Mature / gravelly",
  upbeat_lively: "Upbeat / lively",
};

/**
 * `<select>` children: style-grouped names from the API plus every official Gemini Live
 * prebuilt voice (`allGeminiVoices`) so admin and mock setup match the live session.
 */
export function GeminiVoiceSelectOptions({ voiceStyles, allGeminiVoices, fallbackValue }) {
  const fb = String(fallbackValue || "Kore").trim() || "Kore";
  const haveFull = Array.isArray(allGeminiVoices) && allGeminiVoices.length > 0;
  const seen = new Set();
  const parts = [];

  if (voiceStyles && typeof voiceStyles === "object") {
    for (const [styleKey, names] of Object.entries(voiceStyles)) {
      const list = (names || []).filter(Boolean);
      for (const n of list) seen.add(n);
      if (!list.length) continue;
      parts.push(
        <optgroup key={styleKey} label={VOICE_STYLE_LABELS[styleKey] || styleKey}>
          {list.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>,
      );
    }
  }

  if (haveFull) {
    const extras = [...new Set(allGeminiVoices.map(String))]
      .filter((n) => !seen.has(n))
      .sort((a, b) => a.localeCompare(b));
    for (const n of extras) seen.add(n);
    if (extras.length) {
      parts.push(
        <optgroup key="__more_gemini" label="More Gemini Live voices">
          {extras.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>,
      );
    }
  }

  if (!parts.length && haveFull) {
    const sorted = [...new Set(allGeminiVoices.map(String))].sort((a, b) => a.localeCompare(b));
    for (const n of sorted) seen.add(n);
    return (
      <>
        {!seen.has(fb) ? (
          <option key="__fb" value={fb}>
            {fb}
          </option>
        ) : null}
        {sorted.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </>
    );
  }

  if (!parts.length) {
    return (
      <option value={fb} key="__only">
        {fb}
      </option>
    );
  }

  return (
    <>
      {!seen.has(fb) ? (
        <option key="__fb" value={fb}>
          {fb}
        </option>
      ) : null}
      {parts}
    </>
  );
}
