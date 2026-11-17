// ./src/config/auth.ts

import type { AxiosRequestConfig } from "axios";
import { http, session } from "@/core/facade";

/**
 * auth.ts (app config) - the deskapp <-> server auth contract, and the client
 * that honours it.
 *
 * **Edit the contract at the top, not the mechanism below.** Everything the
 * client needs to know about *your* server lives in `AUTH`:
 *
 *   - `paths`       the endpoints (login / refresh / logout / me)
 *   - `keys`        the names used in the main-process `session` store
 *   - `header`      the request header the access token rides in
 *   - `refreshBody` the body sent to `paths.refresh`
 *   - `readTokens`  how to pull the token pair + user out of a response body
 *
 * Change a field name, a route, the header, or the whole response shape here
 * and the `app.auth.*` handlers plus every `http` call follow — no other file
 * needs to change.
 *
 * Importing this module installs the interceptors (see `install`). `src/main.ts`
 * imports it at boot (`import "@config/auth";`) so the install is explicit and
 * does not depend on any controller being loaded.
 *
 * The server side is nexwire's shipped auth module (see the nexwire
 * `guide/auth.md` "Bearer tokens" section): login returns
 * `{ user, access_token, refresh_token, token_type }` in the body and the guard
 * reads the bearer header before the cookie.
 */

// ── Contract — edit for your server ─────────────────────────────────────────

export type AuthUser = Record<string, unknown> | null;

/** The token pair + user read out of a login/refresh response. */
export type AuthTokens = {
  access: string | null;
  refresh: string | null;
  user: AuthUser;
};

/** The response body nexwire returns for login/refresh. Override in `readTokens`. */
export type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
};

export const AUTH = {
  /** Endpoints, relative to `API_URL` (an absolute `http(s)://…` passes through). */
  paths: {
    login: "/api/auth/login",
    refresh: "/api/auth/refresh-token",
    logout: "/api/auth/logout",
    me: "/api/auth/me"
  },

  /** Session-store keys. The token pair lives in the main process only. */
  keys: {
    access: "accessToken",
    refresh: "refreshToken",
    user: "user"
  },

  /** The request header the access token rides in. */
  header: {
    name: "Authorization",
    scheme: "Bearer"
  },

  /** The body sent to `paths.refresh`. Change it when your server names the field differently. */
  refreshBody(refreshToken: string): Record<string, unknown> {
    return { refresh_token: refreshToken };
  },

  /**
   * Pull the token pair + user out of a login/refresh response body. `payload`
   * is the server's `data` (the `{ message, data }` envelope is unwrapped for
   * you). Return `null` for anything the server did not send.
   */
  readTokens(payload: unknown): AuthTokens {
    const p = (payload ?? {}) as TokenPayload;
    return {
      access: typeof p.access_token === "string" ? p.access_token : null,
      refresh: typeof p.refresh_token === "string" ? p.refresh_token : null,
      user: (p.user as AuthUser) ?? null
    };
  }
};

/** The shape every auth handler returns to the renderer — never carries a token. */
export type AuthResult = {
  ok: boolean;
  status: number;
  user: AuthUser;
  offline?: boolean;
  error?: string;
};

// ── Mechanism — the client that honours the contract ────────────────────────

/** Persist the token pair + user into the app session. */
export function storeTokens(payload: unknown): void {
  const { access, refresh, user } = AUTH.readTokens(payload);
  const patch: Record<string, unknown> = {};
  if (access) patch[AUTH.keys.access] = access;
  if (refresh) patch[AUTH.keys.refresh] = refresh;
  if (user) patch[AUTH.keys.user] = user;
  if (Object.keys(patch).length) session.merge(session.DEFAULT, patch);
}

/** Cache the signed-in user in the session. */
export function saveUser(user: AuthUser): void {
  if (user) session.set(session.DEFAULT, AUTH.keys.user, user);
}

/** The stored access token, or null. */
export function accessToken(): string | null {
  return session.get<string>(session.DEFAULT, AUTH.keys.access);
}

/** The stored user, or null. */
export function currentUser(): AuthUser {
  return session.get<AuthUser>(session.DEFAULT, AUTH.keys.user);
}

/** Forget the token pair + user. */
export function clearSession(): void {
  session.destroy(session.DEFAULT);
}

/**
 * Refresh the token pair once, de-duplicating concurrent callers so a burst of
 * 401s performs a single rotation (the server revokes the old refresh token, so
 * a second concurrent refresh with it would fail).
 */
let refreshing: Promise<boolean> | null = null;

export async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refreshToken = session.get<string>(session.DEFAULT, AUTH.keys.refresh);
    if (!refreshToken) return false;

    const res = await http.post(AUTH.paths.refresh, { body: AUTH.refreshBody(refreshToken) });
    const payload = (res.data as { data?: unknown } | null)?.data;
    const tokens = AUTH.readTokens(payload);
    if (!res.ok || !tokens.access) {
      // The refresh token is expired or revoked — sign out.
      clearSession();
      return false;
    }
    storeTokens(payload);
    return true;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

/** The configured header name/value for a token (`"Bearer <token>"` by default). */
function headerValue(token: string): string {
  const { scheme } = AUTH.header;
  return scheme ? `${scheme} ${token}` : token;
}

/** Read our auth header off a request's headers, if it is already set. */
function authHeaderOf(headers: unknown): string | undefined {
  if (!headers) return undefined;
  const name = AUTH.header.name;
  const getter = (headers as { get?: (name: string) => unknown }).get;
  if (typeof getter === "function") {
    const value = getter.call(headers, name);
    return value ? String(value) : undefined;
  }
  const plain = headers as Record<string, unknown>;
  const value = plain[name] ?? plain[name.toLowerCase()];
  return value ? String(value) : undefined;
}

/** Set our auth header on an axios request config. */
function setAuthHeader(config: AxiosRequestConfig, value: string): void {
  const name = AUTH.header.name;
  const headers = config.headers as { set?: (name: string, value: string) => void } | undefined;
  if (headers && typeof headers.set === "function") headers.set(name, value);
  else config.headers = { ...(headers ?? {}), [name]: value } as AxiosRequestConfig["headers"];
}

/**
 * Install the bearer + refresh interceptors on the shared axios client, once.
 * Runs on module load (see `src/main.ts`), so every `http` call from then on is
 * authenticated.
 */
let installed = false;

export function install(): void {
  if (installed) return;
  installed = true;

  http.client.interceptors.request.use((config) => {
    const retried = Boolean((config as { __deskappRetried?: boolean }).__deskappRetried);
    const token = accessToken();
    // Never override an explicit header, but do replace our own stale one on a retry.
    if (token && (retried || !authHeaderOf(config.headers))) {
      setAuthHeader(config, headerValue(token));
    }
    return config;
  });

  http.client.interceptors.response.use(async (response) => {
    const config = response.config as AxiosRequestConfig & { __deskappRetried?: boolean };
    if (response.status !== 401 || config.__deskappRetried) return response;

    const url = String(config.url ?? "");
    // Login/refresh answer 401 for bad credentials — that is not a stale token.
    if (url.endsWith(AUTH.paths.login) || url.endsWith(AUTH.paths.refresh)) return response;

    if (!(await refreshTokens())) return response;

    config.__deskappRetried = true;
    return http.client.request(config);
  });
}

install();
