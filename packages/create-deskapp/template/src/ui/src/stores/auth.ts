// ./src/ui/src/stores/auth.ts

import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Auth store for a remote server API.
 *
 * The renderer never holds a token: the main process signs in through the
 * `app.auth` bindings, keeps the token pair in the core `session` store (and in
 * `safeStorage` at rest), and attaches `Authorization: Bearer …` to every `http`
 * call. This store only owns the UI-facing state — the user, a loading flag and
 * the offline flag. See guide/remote-api.md.
 */

type AuthUser = Record<string, unknown> | null;

type AuthResult = {
  ok: boolean;
  status: number;
  user: AuthUser;
  offline?: boolean;
  error?: string;
};

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser>(null);
  const loading = ref(false);
  const offline = ref(false);

  /** Sign in. Throws with `.response` on failure, like a form submit expects. */
  async function login(email: string, password: string, remember = false) {
    loading.value = true;
    try {
      const res = (await bindings["app.auth.login"]({ email, password, remember })) as AuthResult;
      offline.value = Boolean(res.offline);
      user.value = res.ok ? res.user : null;
      if (!res.ok) throw Object.assign(new Error(res.error || "Login failed"), { response: res });
      return res.user;
    } finally {
      loading.value = false;
    }
  }

  /** Re-read the signed-in user from the server (refreshes the token on 401). */
  async function me() {
    const res = (await bindings["app.auth.me"]()) as AuthResult;
    offline.value = Boolean(res.offline);
    user.value = res.ok ? res.user : null;
    return res;
  }

  /** Signed-in state from the local session, with no network call. */
  async function status() {
    const res = (await bindings["app.auth.status"]()) as { authenticated: boolean; user: AuthUser };
    user.value = res.authenticated ? res.user : null;
    return res;
  }

  /** Sign out locally, then best-effort tell the server. */
  async function logout() {
    await bindings["app.auth.logout"]();
    user.value = null;
  }

  return { user, loading, offline, login, me, status, logout };
});
