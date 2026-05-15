export const BASE = import.meta.env.VITE_API_BASE || "";

export function apiUrl(path) {
  return BASE + path;
}

export function voiceKeyFromSetup(voiceLabel) {
  const v = (voiceLabel || "").toLowerCase();
  if (v.includes("male") && !v.includes("female")) return "male_indian";
  if (v.includes("female")) return "female_indian";
  if (v.includes("random")) return "random";
  return "female_indian";
}

export async function tayyarGemini({ system, prompt, history }) {
  const r = await fetch(BASE + "/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, prompt: prompt || "", history: history || [] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || data.message || r.statusText || "Gemini error");
  }
  return data.text || "";
}

export async function tayyarTts(text, voiceKey) {
  const r = await fetch(BASE + "/api/elevenlabs/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceKey: voiceKey || "female_indian" }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "TTS error");
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

window.tayyarGemini = tayyarGemini;
window.tayyarTts = tayyarTts;
window.tayyarVoiceKeyFromSetup = voiceKeyFromSetup;
