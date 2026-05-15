/** Saved interview subjects (resume-backed profiles). Synced from onboarding + mock setup. */

export const CANDIDATES_KEY = "tayyar-interview-candidates";

export function loadInterviewCandidates() {
  try {
    const raw = localStorage.getItem(CANDIDATES_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveInterviewCandidates(list) {
  localStorage.setItem(CANDIDATES_KEY, JSON.stringify(list));
}

export function seedPrimaryCandidateFromProfile(profile) {
  const name = (profile?.basics?.name || "").trim() || "Candidate";
  const entry = {
    id: "primary",
    label: name,
    profile: JSON.parse(JSON.stringify(profile)),
  };
  saveInterviewCandidates([entry]);
}
