// ./src/ui/src/stores/server.ts

import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Example store for a remote server API.
 *
 * The network call runs in the Electron main process through the `app.net`
 * bindings - no CORS, the base URL comes from the runtime `API_URL` in `.env`,
 * and a failed call returns `{ ok: false, offline: true }` instead of throwing.
 * The store only owns state and the call surface. See guide/remote-api.md.
 *
 * Backend code (a controller, job or schedule) skips this and calls the facade
 * helper directly: `import { http } from "@/core/facade"; await http.get(...)`.
 */
export const useServerStore = defineStore("server", () => {
  const base = ref("");
  const configured = ref(false);
  const loading = ref(false);
  const last = ref<Record<string, unknown> | null>(null);

  /** Read the runtime API base URL (`API_URL` in .env). */
  async function init() {
    const res = (await bindings["app.net.apiBase"]()) as { url: string; configured: boolean };
    base.value = res.url;
    configured.value = res.configured;
    return res;
  }

  /**
   * Call the configured server. `path` is appended to `API_URL`:
   *
   *   await server.call("/api/auth/login", { method: "POST", body: { email, password } });
   *   await server.call("/api/wallet/balance", { token: accessToken });
   */
  async function call(path: string, init?: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> }) {
    loading.value = true;
    try {
      const res = (await bindings["app.net.apiFetch"](path, init)) as Record<string, unknown>;
      last.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  return { base, configured, loading, last, init, call };
});
