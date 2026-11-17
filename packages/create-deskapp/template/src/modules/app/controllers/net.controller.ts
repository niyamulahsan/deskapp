// ./src/modules/app/controllers/net.controller.ts

import axios from "axios";

/**
 * net.controller.ts (app module) - backend proxy for server API calls.
 *
 * The renderer's own fetch()/axios is blocked by CORS on cross-origin APIs and,
 * when the app is packaged, runs from a `file://` origin. Calling the API here -
 * in the Electron main process - avoids CORS entirely and lets the base URL come
 * from the runtime `.env` instead of the build. The renderer asks
 * `app.net.apiFetch(path)` and the JSON-safe payload comes back through the
 * bindings. Handlers:
 *
 *   apiBase()      -> app.net.apiBase      runtime API base URL + configured flag
 *   apiFetch(path) -> app.net.apiFetch     fetch `${API_URL}${path}` (offline-safe)
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

/**
 * Shared axios instance for server API calls. Exported so you can attach
 * interceptors or change defaults (e.g. `http.defaults.timeout = 30_000`).
 * `validateStatus` makes HTTP errors resolve instead of throw, so `apiFetch`
 * keeps one uniform envelope; only network failures reject.
 */
export const http = axios.create({
  validateStatus: () => true
});

/** Runtime API base URL from the environment (no trailing slash). */
export function apiBaseUrl(): string {
  const raw = (process.env.API_URL || process.env.VITE_API_URL || "").trim();
  return raw.replace(/\/+$/, "");
}

/** Report the runtime API base so the UI can show "configured" vs "offline". */
export const apiBase = async (): Promise<Record<string, unknown>> => {
  const url = apiBaseUrl();
  return { ok: true, url, configured: url.length > 0 };
};

type ApiInit = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Convenience: sets `Authorization: Bearer <token>` when no header is given. */
  token?: string | null;
};

/**
 * Proxy one call to the configured server API. `path` is appended to the
 * runtime `API_URL` (or may be an absolute http(s) URL). axios JSON-encodes an
 * object `body` and sets `Content-Type` for you. Never throws: a network
 * failure returns `{ ok: false, offline: true }` so the UI can branch instead
 * of catching.
 */
export const apiFetch = async (path: string, init?: ApiInit): Promise<Record<string, unknown>> => {
  const base = apiBaseUrl();
  const clean = (path ?? "").trim();
  if (!clean) return { ok: false, error: "path is required" };

  const absolute = /^https?:\/\//i.test(clean);
  if (!absolute && !base) {
    return { ok: false, offline: true, error: "API_URL is not set (add it to .env)" };
  }
  const url = absolute ? clean : `${base}${clean.startsWith("/") ? clean : `/${clean}`}`;

  const headers: Record<string, string> = { Accept: "application/json", ...(init?.headers ?? {}) };
  if (init?.token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${init.token}`;
  }

  try {
    const res = await http.request({
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      data: init?.body,
      headers
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, url, data: res.data };
  } catch (error) {
    return { ok: false, offline: true, url, error: error instanceof Error ? error.message : String(error) };
  }
};

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
