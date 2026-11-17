// ./src/modules/app/controllers/auth.controller.ts

import { AUTH, type AuthResult, type AuthUser, accessToken, clearSession, currentUser, saveUser, storeTokens } from "@config/auth";
import { http, validate } from "@/core/facade";
import { LoginSchema, type LoginType } from "@/modules/app/controllers/auth.schema";

/**
 * auth.controller.ts (app module) - the `app.auth.*` bindings.
 *
 * The binding surface only: login / me / logout / status. Everything about
 * *how* the client authenticates — the endpoints, the session keys, the header,
 * the token shape and the two interceptors on `http.client` — lives in
 * `@config/auth` (edit that file for your server). Importing `@config/auth`
 * installs the interceptors once; `src/main.ts` does so at boot, so every
 * `http` call from any module is authenticated without per-module wiring.
 *
 *   login(body)  -> app.auth.login    POST login, store the token pair
 *   me()         -> app.auth.me       GET  me (refreshes on 401)
 *   logout()     -> app.auth.logout   drop the session (+ best-effort revoke)
 *   status()     -> app.auth.status   signed-in state, no network
 *
 * The token pair lives in the core `session` store **in the main process only**,
 * encrypted at rest via `safeStorage` when available; the renderer drives these
 * handlers through bindings and never sees a token.
 *
 * This is the deskapp half of the pattern documented in guide/remote-api.md.
 */

export type { AuthResult, AuthUser } from "@config/auth";

/** Sign in and store the token pair; returns the user, never the tokens. */
export const login = async (body: unknown): Promise<AuthResult> => {
  const data: LoginType = await validate.run(LoginSchema, body);
  const res = await http.post(AUTH.paths.login, { body: data });
  const payload = (res.data as { data?: unknown } | null)?.data;

  const tokens = AUTH.readTokens(payload);
  if (res.ok && tokens.access) {
    storeTokens(payload);
    return { ok: true, status: res.status, user: tokens.user };
  }

  const message = (res.data as { message?: string } | null)?.message;
  return { ok: false, status: res.status, user: null, offline: res.offline, error: res.error ?? message };
};

/** The signed-in user, refreshing the token silently on a `401`. */
export const me = async (): Promise<AuthResult> => {
  if (!accessToken()) {
    return { ok: false, status: 401, user: null };
  }

  const res = await http.get(AUTH.paths.me);
  const user = (res.data as { data?: AuthUser } | null)?.data ?? null;

  if (res.ok && user) saveUser(user);
  if (res.status === 401) clearSession();

  return { ok: res.ok, status: res.status, user: res.ok ? user : null, offline: res.offline, error: res.error };
};

/**
 * Sign out locally, then best-effort tell the server. The shipped nexwire
 * logout revokes the **refresh cookie**, so a bearer client's call returns 200
 * but does not revoke server-side; call `/api/auth/logout-all` to revoke for
 * real. See guide/remote-api.md.
 */
export const logout = async (): Promise<{ ok: boolean }> => {
  const token = accessToken();
  clearSession();
  await http.post(AUTH.paths.logout, { token });
  return { ok: true };
};

/** Signed-in state from the local session, with no network call. */
export const status = (): { authenticated: boolean; user: AuthUser } => ({
  authenticated: Boolean(accessToken()),
  user: currentUser()
});

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { login, me, logout, status };
