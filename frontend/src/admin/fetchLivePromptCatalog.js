import { mergeFrontendIntoCatalog } from "./frontendPromptCatalog";

/**
 * Load production prompts from backend + merge frontend-only Session Context pieces.
 */
export async function fetchLivePromptCatalog() {
  const adminKey = import.meta.env.VITE_ADMIN_API_KEY || "";
  const headers = adminKey ? { "X-Admin-Key": adminKey } : {};
  const res = await fetch("/api/v1/admin/prompt-catalog", { headers });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Prompt catalog failed (${res.status})`);
  }
  const data = await res.json();
  return mergeFrontendIntoCatalog(data);
}
