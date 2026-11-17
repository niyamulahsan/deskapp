// ./src/core/utils/http.ts

import axios, { type AxiosInstance } from "axios";

/**
 * http - call a remote HTTP(S) API from the main process.
 *
 * Import it from the facade, never from here:
 *
 *   import { http } from "@/core/facade";
 *
 *   const res   = await http.get("/api/wallet/balance", { token });
 *   const login = await http.post("/api/auth/login", { email, password });
 *
 * - The base URL is `API_URL` in `.env`, read at runtime, so one build works
 *   for local and production. An absolute `http(s)://…` path ignores the base.
 * - A missing scheme is filled in: `localhost:3000` -> `http://localhost:3000`,
 *   `wallet.example.com` -> `https://wallet.example.com`.
 * - It never throws: an unreachable server returns `{ ok: false, offline: true }`,
 *   so you branch instead of catching.
 * - `body` is JSON-encoded for you and `token` sets `Authorization: Bearer …`.
 */

export type HttpResult<T = unknown> = {
  /** True for a 2xx response. */
  ok: boolean;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  data: T | null;
  url: string;
  /** True when the server could not be reached (no response). */
  offline?: boolean;
  error?: string;
};

export type HttpOptions = {
  method?: string;
  /** Request body. An object is JSON-encoded and `Content-Type` set for you. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Sets `Authorization: Bearer <token>` unless that header is already given. */
  token?: string | null;
  /** Query-string parameters. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Milliseconds; falls back to the axios default. */
  timeout?: number;
};

/**
 * The shared axios instance. `validateStatus` makes HTTP errors (4xx/5xx)
 * resolve instead of throw, so `request` keeps one uniform envelope; only a
 * real network failure rejects. Attach interceptors or change defaults here:
 *
 *   http.client.defaults.timeout = 30_000;
 */
const client: AxiosInstance = axios.create({ validateStatus: () => true });

/** Add a scheme when it is missing: local hosts -> http, everything else -> https. */
function withScheme(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  const host = value.replace(/^\/+/, "");
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:|\/|$)/i.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** The configured base URL (no trailing slash), or "" when unset. */
export function baseUrl(): string {
  const raw = (process.env.API_URL || process.env.VITE_API_URL || "").trim();
  return raw ? withScheme(raw).replace(/\/+$/, "") : "";
}

/** Join a path to the base URL, or return an absolute URL untouched. */
export function resolveUrl(path: string): string {
  const clean = (path ?? "").trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  const base = baseUrl();
  if (!base) return "";
  return `${base}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

/**
 * Call the API and return `{ ok, status, data, url, offline?, error? }`.
 * Never throws. `path` is appended to `API_URL`, or may be an absolute URL.
 */
async function request<T = unknown>(path: string, options: HttpOptions = {}): Promise<HttpResult<T>> {
  const clean = (path ?? "").trim();
  if (!clean) return { ok: false, status: 0, data: null, url: "", error: "path is required" };

  const url = resolveUrl(clean);
  if (!url) {
    return { ok: false, status: 0, data: null, url: clean, offline: true, error: "API_URL is not set (add it to .env)" };
  }

  const headers: Record<string, string> = { Accept: "application/json", ...(options.headers ?? {}) };
  if (options.token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const res = await client.request<T>({
      url,
      method: (options.method ?? "GET").toUpperCase(),
      data: options.body,
      headers,
      params: options.query,
      timeout: options.timeout
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data ?? null, url };
  } catch (error) {
    return { ok: false, status: 0, data: null, url, offline: true, error: error instanceof Error ? error.message : String(error) };
  }
}

/** A verb helper: same as `request` with the method fixed. */
type Verb = <T = unknown>(path: string, options?: Omit<HttpOptions, "method">) => Promise<HttpResult<T>>;

export const http = {
  /** The configured base URL (`API_URL`), or "". */
  baseUrl,
  /** Resolve a path against the base (absolute URLs pass through). */
  resolveUrl,
  /** Full control: `http.request(path, { method, body, token, … })`. */
  request,
  /** The raw axios instance, for interceptors or throw-on-error behavior. */
  client,
  get: ((path, options) => request(path, { ...options, method: "GET" })) as Verb,
  post: ((path, options) => request(path, { ...options, method: "POST" })) as Verb,
  put: ((path, options) => request(path, { ...options, method: "PUT" })) as Verb,
  patch: ((path, options) => request(path, { ...options, method: "PATCH" })) as Verb,
  delete: ((path, options) => request(path, { ...options, method: "DELETE" })) as Verb
};
