// ./src/modules/app/controllers/net.controller.ts

import { http } from "@/core/facade";

/**
 * net.controller.ts (app module) - backend proxy for server API calls.
 *
 * The renderer's own fetch()/axios is blocked by CORS on cross-origin APIs and,
 * when the app is packaged, runs from a `file://` origin. Calling the API here -
 * in the Electron main process - avoids CORS entirely and lets the base URL come
 * from the runtime `.env` instead of the build.
 *
 * The HTTP work lives in the facade's `http` helper (`@/core/utils/http.ts`), so
 * a module can call the server in one line:
 *
 *   import { http } from "@/core/facade";
 *   const res = await http.get("/api/wallet/balance", { token });
 *
 * This controller only exposes it to the renderer as bindings. Handlers:
 *
 *   apiBase()      -> app.net.apiBase      runtime API base URL + configured flag
 *   apiFetch(path) -> app.net.apiFetch     `${API_URL}${path}` (offline-safe)
 *   fetchJson(url) -> app.net.fetchJson    any absolute http(s) URL (JSON or text)
 *   placeholder()  -> app.net.placeholder  jsonplaceholder.typicode.com
 *
 * Configure the server in `.env` (read at runtime by src/main.ts):
 *
 *   API_URL=http://localhost:3000
 *
 * See guide/remote-api.md and the dashboard "Network" card.
 */

const MAX_BODY = 50_000;

/** Report the runtime API base so the UI can show "configured" vs "offline". */
export const apiBase = async (): Promise<Record<string, unknown>> => {
  const url = http.baseUrl();
  return { ok: true, url, configured: url.length > 0 };
};

type ApiInit = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Convenience: sets `Authorization: Bearer <token>` when no header is given. */
  token?: string | null;
};

/** Proxy one call to the configured server API. Never throws (see the facade `http`). */
export const apiFetch = (path: string, init?: ApiInit) => http.request(path, init);

/** Proxy one http(s) fetch from the backend; returns JSON (or text) safely. */
export const fetchJson = async (url: string | undefined): Promise<Record<string, unknown>> => {
  const clean = (url ?? "").trim();
  if (!/^https?:\/\//i.test(clean)) {
    return { ok: false, action: "fetch", error: "enter a valid http(s) URL" };
  }
  try {
    const res = await fetch(clean, { headers: { Accept: "application/json" } });
    const text = await res.text();
    let data: unknown;
    if (text.length <= MAX_BODY) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } else {
      data = `${text.slice(0, 2000)}... (truncated, ${text.length} bytes)`;
    }
    return { ok: res.ok, status: res.status, url: clean, bytes: text.length, data };
  } catch (error) {
    return { ok: false, action: "fetch", url: clean, error: String(error) };
  }
};

/** One-click demo against JSONPlaceholder (no input needed). */
export const placeholder = async (): Promise<Record<string, unknown>> => {
  return await fetchJson("https://jsonplaceholder.typicode.com/todos/1");
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { apiBase, apiFetch, fetchJson, placeholder };
