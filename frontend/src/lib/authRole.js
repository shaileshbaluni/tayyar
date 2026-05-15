/** App entry role: unauthenticated | student app shell | admin console */
const KEY = "tayyar-app-role";

/** @returns {null | 'student' | 'admin'} */
export function getRole() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "student" || v === "admin") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** @param {'student' | 'admin'} role */
export function setRole(role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    /* ignore */
  }
}

export function clearRole() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
