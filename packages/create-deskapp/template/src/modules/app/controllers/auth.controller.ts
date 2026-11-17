// ./src/modules/app/controllers/auth.controller.ts

import type { AxiosRequestConfig } from "axios";
import { http, session, validate } from "@/core/facade";
import { LoginSchema, type LoginType } from "@/modules/app/controllers/auth.schema";

/**
 * auth.controller.ts (app module) - a bearer auth client for a nexwire server.
 *
 * The desktop has no browser cookie jar (the main process has no origin and a
 * packaged renderer runs from `file://`), so it authenticates with a bearer
 * token instead of nexwire's httpOnly cookie. This controller is that client:
 *
 *   login(body)  -> app.auth.login    POST /api/auth/login, store the token pair
 *   me()         -> app.auth.me       GET  /api/auth/me (refreshes on 401)
 *   logout()     -> app.auth.logout   drop the session (+ best-effort revoke)
 *   status()     -> app.auth.status   signed-in state, no network
 *
 * The token pair lives in the core `session` store **in the main process only**,
 * encrypted at rest via `safeStorage` when available; the renderer drives these
 * handlers through bindings and never sees a token. Two axios interceptors on
 * `http.client` make every `http` call authenticated: a request interceptor
 * attaches `Authorization: Bearer <access token>`, and a response interceptor
 * turns a `401` into one silent `POST /api/auth/refresh-token` + retry.
 *
 * The server side is nexwire's shipped auth module (see the nexwire
 * `guide/auth.md` "Bearer tokens" section): login returns
 * `{ user, access_token, refresh_token, token_type }` in the body and the guard
 * reads the bearer header before the cookie.
 *
 * This is the deskapp half of the pattern documented in guide/remote-api.md.
 */

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "user";

const LOGIN_PATH = "/api/auth/login";
const REFRESH_PATH = "/api/auth/refresh-token";
const LOGOUT_PATH = "/api/auth/logout";
const ME_PATH = "/api/auth/me";

export type AuthUser = Record<string, unknown> | null;

/** The shape every handler returns to the renderer — never carries a token. */
export type AuthResult = {
  ok: boolean;
  status: number;
  user: AuthUser;
  offline?: boolean;
  error?: string;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  user?: AuthUser;
};

/** Read the token pair + user out of a login/refresh response body. */
function readTokens(payload: TokenPayload | undefined): { access: string | null; refresh: string | null; user: AuthUser } {
  return {
    access: typeof payload?.access_token === "string" ? payload.access_token : null,
    refresh: typeof payload?.refresh_token === "string" ? payload.refresh_token : null,
    user: payload?.user ?? null
  };
}

/** Persist the token pair + user into the app session. */
function storeTokens(payload: TokenPayload | undefined): void {
  const { access, refresh, user } = readTokens(payload);
  const patch: Record<string, unknown> = {};
  if (access) patch[ACCESS_KEY] = access;
  if (refresh) patch[REFRESH_KEY] = refresh;
  if (user) patch[USER_KEY] = user;
  if (Object.keys(patch).length) session.merge(session.DEFAULT, patch);
}

/**
 * Refresh the token pair once, de-duplicating concurrent callers so a burst of
 * 401s performs a single rotation (the server revokes the old refresh token, so
 * a second concurrent refresh with it would fail).
 */
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const refreshToken = session.get<string>(session.DEFAULT, REFRESH_KEY);
    if (!refreshToken) return false;

    const res = await http.post(REFRESH_PATH, { body: { refresh_token: refreshToken } });
    const payload = (res.data as { data?: TokenPayload } | null)?.data;
    if (!res.ok || !payload?.access_token) {
      // The refresh token is expired or revoked — sign out.
      session.destroy(session.DEFAULT);
      return false;
    }
    storeTokens(payload);
    return true;
  })().finally(() => {
    refreshing = null;
  });

  return refreshing;
}

function authHeaderOf(headers: unknown): string | undefined {
  if (!headers) return undefined;
  const getter = (headers as { get?: (name: string) => unknown }).get;
  if (typeof getter === "function") {
    const value = getter.call(headers, "Authorization");
    return value ? String(value) : undefined;
  }
  const plain = headers as Record<string, unknown>;
  const value = plain.Authorization ?? plain.authorization;
  return value ? String(value) : undefined;
}

function setAuthHeader(config: AxiosRequestConfig, value: string): void {
  const headers = config.headers as { set?: (name: string, value: string) => void } | undefined;
  if (headers && typeof headers.set === "function") headers.set("Authorization", value);
  else config.headers = { ...(headers ?? {}), Authorization: value } as AxiosRequestConfig["headers"];
}

/**
 * Install the bearer + refresh interceptors on the shared axios client, once.
 * Runs on module load (the bindings manifest imports every controller at boot),
 * so every `http` call from then on is authenticated.
 */
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;

  http.client.interceptors.request.use((config) => {
    const retried = Boolean((config as { __deskappRetried?: boolean }).__deskappRetried);
    const token = session.get<string>(session.DEFAULT, ACCESS_KEY);
    // Never override an explicit header, but do replace our own stale one on a retry.
    if (token && (retried || !authHeaderOf(config.headers))) {
      setAuthHeader(config, `Bearer ${token}`);
    }
    return config;
  });

  http.client.interceptors.response.use(async (response) => {
    const config = response.config as AxiosRequestConfig & { __deskappRetried?: boolean };
    if (response.status !== 401 || config.__deskappRetried) return response;

    const url = String(config.url ?? "");
    // Login/refresh answer 401 for bad credentials — that is not a stale token.
    if (url.endsWith(LOGIN_PATH) || url.endsWith(REFRESH_PATH)) return response;

    if (!(await refreshTokens())) return response;

    config.__deskappRetried = true;
    return http.client.request(config);
  });
}

install();

/** Sign in and store the token pair; returns the user, never the tokens. */
export const login = async (body: unknown): Promise<AuthResult> => {
  const data: LoginType = await validate.run(LoginSchema, body);
  const res = await http.post(LOGIN_PATH, { body: data });
  const payload = (res.data as { data?: TokenPayload; message?: string } | null)?.data;

  if (res.ok && payload?.access_token) {
    storeTokens(payload);
    return { ok: true, status: res.status, user: readTokens(payload).user };
  }

  const message = (res.data as { message?: string } | null)?.message;
  return { ok: false, status: res.status, user: null, offline: res.offline, error: res.error ?? message };
};

/** The signed-in user, refreshing the token silently on a `401`. */
export const me = async (): Promise<AuthResult> => {
  if (!session.get<string>(session.DEFAULT, ACCESS_KEY)) {
    return { ok: false, status: 401, user: null };
  }

  const res = await http.get(ME_PATH);
  const user = (res.data as { data?: AuthUser } | null)?.data ?? null;

  if (res.ok && user) session.set(session.DEFAULT, USER_KEY, user);
  if (res.status === 401) session.destroy(session.DEFAULT);

  return { ok: res.ok, status: res.status, user: res.ok ? user : null, offline: res.offline, error: res.error };
};

/**
 * Sign out locally, then best-effort tell the server. The shipped nexwire
 * logout revokes the **refresh cookie**, so a bearer client's call returns 200
 * but does not revoke server-side; call `/api/auth/logout-all` to revoke for
 * real. See guide/remote-api.md.
 */
export const logout = async (): Promise<{ ok: boolean }> => {
  const token = session.get<string>(session.DEFAULT, ACCESS_KEY);
  session.destroy(session.DEFAULT);
  await http.post(LOGOUT_PATH, { token });
  return { ok: true };
};

/** Signed-in state from the local session, with no network call. */
export const status = (): { authenticated: boolean; user: AuthUser } => ({
  authenticated: Boolean(session.get<string>(session.DEFAULT, ACCESS_KEY)),
  user: session.get<AuthUser>(session.DEFAULT, USER_KEY)
});

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { login, me, logout, status };
