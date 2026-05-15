import { DEFAULT_AI_INTERVIEWERS } from "../data/aiInterviewers";
import { apiUrl } from "./api";

const STORAGE_KEY = "tayyar-ai-interviewer-edits";

/** Server catalog from GET /api/v1/ai-interviewers (canonical geminiVoice + copy). */
let serverInterviewers = null;

export function setServerInterviewersCatalog(rows) {
  serverInterviewers = Array.isArray(rows) && rows.length ? rows : null;
}

export function getServerInterviewersCatalog() {
  return serverInterviewers;
}

export async function fetchInterviewersFromApi() {
  const r = await fetch(apiUrl("/api/v1/ai-interviewers"));
  if (!r.ok) throw new Error(`interviewers ${r.status}`);
  const data = await r.json();
  const rows = data.interviewers || [];
  setServerInterviewersCatalog(rows);
  return {
    interviewers: rows,
    voiceStyles: data.voiceStyles || {},
    allGeminiVoices: Array.isArray(data.allGeminiVoices) ? data.allGeminiVoices : [],
  };
}

export function loadPersonaEdits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function savePersonaEdits(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function updatePersonaEdit(id, patch) {
  const cur = loadPersonaEdits();
  const all = { ...cur, [id]: { ...cur[id], ...patch } };
  savePersonaEdits(all);
  return all;
}

export function resetPersonaEdit(id) {
  const all = loadPersonaEdits();
  delete all[id];
  savePersonaEdits(all);
}

export function getMergedInterviewers() {
  const edits = loadPersonaEdits();
  const base = serverInterviewers || DEFAULT_AI_INTERVIEWERS;
  return base.map((row) => ({
    ...row,
    ...(edits[row.id] || {}),
  }));
}

function pickVoice(voices, gender) {
  if (!voices?.length) return null;
  const wantFemale = gender === "female";
  const scored = voices.map((v) => {
    const n = `${v.name} ${v.lang || ""}`.toLowerCase();
    let score = 0;
    if (/india|en-in|hi-in|hindi|bengali|tamil|telugu/i.test(n)) score += 6;
    if (wantFemale && /female|woman|zira|samantha|karen|victoria|susan|fiona|female/i.test(n)) score += 5;
    if (!wantFemale && /male|man|david|daniel|james|mark|richard|fred|male/i.test(n)) score += 5;
    if (/en[-_]?/i.test(v.lang || "")) score += 2;
    if (/hi|hing|india/i.test(n)) score += 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v || voices[0];
}

/**
 * Browser TTS preview. `voiceSlot` picks a different engine voice per interviewer index.
 */
export function speakPreview(text, gender, mode = "interviewer", voiceSlot = 0) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const t = (text || "").trim();
  if (!t) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.rate = mode === "candidate" ? 1 : 0.92;
  u.pitch = mode === "candidate" ? 1.05 : gender === "female" ? 1.02 : 0.98;
  const apply = () => {
    const voices = window.speechSynthesis.getVoices();
    const indianish = (v) => {
      const n = `${v.name} ${v.lang || ""}`.toLowerCase();
      return /india|en-in|hi-in|hindi|bengali|tamil|telugu|en-gb|en-au|en-za|en-sg/i.test(n);
    };
    const pool = voices.filter(indianish);
    const sorted = (pool.length ? pool : [...voices]).sort((a, b) =>
      `${a.lang}|${a.name}`.localeCompare(`${b.lang}|${b.name}`),
    );
    const idx = Math.abs(Number(voiceSlot) || 0) % Math.max(1, sorted.length);
    const chosen = sorted[idx] || pickVoice(voices, gender);
    if (chosen) u.voice = chosen;
    window.speechSynthesis.speak(u);
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) apply();
  else window.speechSynthesis.onvoiceschanged = apply;
}

export function stopPreviewSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/** Push local persona edits that should be team defaults (e.g. geminiVoice) to the API. */
export async function pushInterviewerPatchesToServer(patchesById) {
  const r = await fetch(apiUrl("/api/v1/ai-interviewers/overrides"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patches: patchesById }),
  });
  if (!r.ok) throw new Error(`overrides ${r.status}`);
  const data = await r.json();
  if (data.interviewers) setServerInterviewersCatalog(data.interviewers);
  return data;
}
