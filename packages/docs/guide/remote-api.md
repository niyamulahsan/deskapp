# Calling a Server API

Deskapp has **two kinds of calls** and they are not the same thing:

| | In-process `bindings` | Remote server API |
| --- | --- | --- |
| Transport | Electron IPC (no network) | HTTP(S) |
| Runs in | the main process | a server somewhere |
| Offline | always works | fails when unreachable |
| Examples | SQLite, files, windows, queue, cron | login, balance, uploads to your backend |

Everything local keeps using `bindings` (see [Controllers & Bindings](./controllers)). This page is about the second column: calling **your own HTTP API** from a desktop app, where the URL is known only at runtime and the user may be offline.

## Why route server calls through the main process

The renderer's own `fetch`/`axios` runs in a Chromium window whose origin is `http://localhost:5173` in dev and `file://` when packaged. That causes three problems:

1. **CORS** — a cross-origin API is blocked unless the server opts in.
2. **Cookies** — a `file://` page is a third-party origin, so an `httpOnly` login cookie usually will not stick.
3. **Build-time URL** — `import.meta.env.*` is baked into the bundle, so one build cannot point at `localhost` today and your VPS tomorrow.

Calling the API **in a controller** removes all three: the main process has no origin (no CORS, no third-party cookie rule) and it reads `.env` at **runtime**. That is the recommended route here — it is also the one the template ships.

## The built-in primitives (`app.net`)

The starter already contains everything you need in `src/modules/app/controllers/net.controller.ts`, exposed as bindings:

| Binding | Signature | Purpose |
| --- | --- | --- |
| `app.net.apiBase` | `() => { ok, url, configured }` | Reports the runtime `API_URL`. |
| `app.net.apiFetch` | `(path, init?) => { ok, status, data, offline?, error? }` | Calls `${API_URL}${path}` via axios. Never throws. |
| `app.net.fetchJson` | `(url) => { ok, status, data }` | Fetches any absolute `http(s)` URL. |
| `app.net.placeholder` | `() => { ... }` | One-click JSONPlaceholder demo. |

`apiFetch`'s `init` is `{ method?, body?, headers?, token? }` — `body` is JSON-encoded for you, and `token` sets `Authorization: Bearer <token>`.

It is backed by a **shared axios instance** (`axios` is already a dependency — `gum` uses it), so object bodies, JSON parsing and `Content-Type` are handled for you. The instance is exported from the controller as `http`, so you can attach interceptors or set a timeout (`http.defaults.timeout = 30_000`) without touching `apiFetch`.

```ts
// in any component or store (Electron renderer only)
const res = await bindings["app.net.apiFetch"]("/api/wallet/balance", { token });
// res = { ok: true, status: 200, url: "https://wallet.example/api/wallet/balance", data: { ... } }
```

You can try it live from the dashboard **Network** card — it has `API base` and `API fetch` buttons.

## Configure the base URL (`API_URL`)

The base URL comes from `.env` at the **project root**, read by the main process at boot (`src/main.ts` → `loadEnv()`), so changing it needs no rebuild:

```sh
# .env
API_URL=http://localhost:3000        # dev
# API_URL=https://wallet.example.com # production
```

Leave it empty to run fully offline — `apiFetch` then returns `{ ok: false, offline: true }`.

> `VITE_API_URL` / `VITE_SOCKET_URL` are a **different** pair: they are Vite build-time variables for the renderer bundle (the dev proxy and the Pulse socket). See [Dev vs production](#dev-vs-production). Prefer `API_URL` for the server base.

## Walkthrough: a wallet module

Say your server exposes `POST /api/auth/login` and `GET /api/wallet/balance`, and you want the desktop to show the balance before each automation run.

### 1. Scaffold the module

```sh
npm run maker -- make:module wallet
npm run maker -- bindings:gen      # register the new controller
```

(For a pure API proxy with no model, `npm run maker -- make:controller wallet api` on an existing module is enough.)

### 2. Write the controller

Handlers run in the main process, so they can read `process.env` and use `axios` (already a dependency). Validate input, return a JSON-safe envelope, and never throw — return `offline: true` instead.

```ts
// ./src/modules/wallet/controllers/api.controller.ts

import axios from "axios";
import { validate } from "@/core/facade";
import { LoginSchema } from "@/modules/wallet/controllers/api.schema";

const base = () => (process.env.API_URL || "").replace(/\/+$/, "");
// HTTP errors resolve instead of throw, so the envelope stays uniform.
const http = axios.create({ validateStatus: () => true });

async function call(path: string, config: { method?: string; data?: unknown } = {}, token?: string | null) {
  if (!base()) return { ok: false, offline: true, error: "API_URL is not set" };
  try {
    const res = await http.request({
      url: `${base()}${path}`,
      method: (config.method ?? "GET").toUpperCase(),
      data: config.data, // axios JSON-encodes an object and sets Content-Type
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data };
  } catch (error) {
    return { ok: false, offline: true, error: error instanceof Error ? error.message : String(error) };
  }
}

export const login = async (body: unknown) => {
  const data = await validate.run(LoginSchema, body);
  return call("/api/auth/login", { method: "POST", data });
};

export const me = async (token: string) => call("/api/auth/me", {}, token);

export const balance = async (token: string) => call("/api/wallet/balance", {}, token);

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { login, me, balance };
```

This creates `wallet.api.login`, `wallet.api.me` and `wallet.api.balance`.

> If you would rather not write a controller at all, skip this step and call the shipped `app.net.apiFetch` from the store in step 3. A dedicated controller is worth it when you want validation, a typed surface, or to hide token handling from the UI.

### 3. Call it from a store

Pages never call the network directly — the store owns the calls and the state. `bindings` is available inside the Electron renderer only, which is exactly where the store runs.

```ts
// ./src/ui/src/stores/wallet.ts

import { defineStore } from "pinia";
import { ref } from "vue";

type Envelope = { ok: boolean; status?: number; data?: any; offline?: boolean; error?: string };

export const useWalletStore = defineStore("wallet", () => {
  const loading = ref(false);
  const balance = ref<number | null>(null);
  const offline = ref(false);

  async function login(email: string, password: string) {
    const res = (await bindings["wallet.api.login"]({ email, password })) as Envelope;
    if (!res.ok) throw Object.assign(new Error(res.error || "Login failed"), { response: res });
    return res.data; // { user, access_token, refresh_token, ... }
  }

  async function loadBalance(token: string) {
    loading.value = true;
    try {
      const res = (await bindings["wallet.api.balance"](token)) as Envelope;
      offline.value = Boolean(res.offline);
      balance.value = res.ok ? (res.data?.data?.balance ?? null) : null;
      return res;
    } finally {
      loading.value = false;
    }
  }

  return { loading, balance, offline, login, loadBalance };
});
```

The template ships a working example of this pattern in `src/ui/src/stores/server.ts`.

### 4. Use it from a page

```vue
<!-- ./src/ui/src/pages/wallet/index.vue -->

<script setup lang="ts">
import { ref } from "vue";
import { useWalletStore } from "@/ui/stores/wallet";

const wallet = useWalletStore();
const email = ref("");
const password = ref("");
const token = ref(localStorage.getItem("token") || "");

async function submit() {
  const data = await wallet.login(email.value, password.value);
  token.value = data.access_token;
  localStorage.setItem("token", token.value);
  await wallet.loadBalance(token.value);
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="email" type="email" placeholder="Email">
    <input v-model="password" type="password" placeholder="Password">
    <button :disabled="wallet.loading">Sign in</button>
  </form>

  <p v-if="wallet.offline">Server unreachable — balance not verified.</p>
  <p v-else-if="wallet.balance !== null">Balance: {{ wallet.balance }}</p>
</template>
```

### 5. Register the route

```ts
// ./src/ui/src/router/index.ts
{ path: "/wallet", name: "wallet", component: () => import("@/ui/pages/wallet/index.vue") }
```

## Authentication

The desktop app is not a browser tab, so decide how the server recognises the client.

### Bearer tokens (recommended for desktop)

The main process keeps a token and sends `Authorization: Bearer <token>`. This is stateless, survives `file://`, and works from any origin. The store holds the token (in memory, or `localStorage`/secure storage); the controller passes it on:

```ts
await bindings["wallet.api.balance"](token);
```

### Cookie sessions

If your server is **cookie-only** (as nexwire's HTTP guard is — it reads a signed `httpOnly` cookie, not the `Authorization` header), then a cross-origin cookie is the problem. Two settings make it work:

- The server must mark the cookie `SameSite=None; Secure` when the API origin differs from the client origin. In nexwire that happens automatically when `FRONTEND_URL` differs from `APP_URL` (see `src/framework/support/cookie.ts`).
- The request must be credentialed. The main process `fetch` does **not** keep a browser cookie jar, so for cookie sessions use Electron's session-bound `net.fetch` instead of the global `fetch` — then the cookie persists in the Electron session.

Bearer is simpler and is what this guide recommends for a desktop client.

### Redirect on `401`

The router uses **hash history** (`createWebHashHistory()`), so a redirect target must be a hash route:

```ts
window.location.hash = "#/login";   // NOT window.location.href = "/login"
```

## Dev vs production

| | Dev (`npm run dev`) | Packaged (`file://`) |
| --- | --- | --- |
| Renderer origin | `http://localhost:5173` | `file://` (opaque) |
| `app.net.apiFetch` | works — main process, no origin | works — main process, no origin |
| `API_URL` | from `.env`, runtime | from `.env` next to the app, runtime |
| Rebuild to change server? | no | no |

**One build works for local and VPS** because the URL is read at runtime. The only thing Vite needs is `envDir`, so `import.meta.env.VITE_*` (used by Pulse) reads the project-root `.env`:

```ts
// ./src/ui/vite.config.ts (already in the template)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "VITE_");
  return {
    envDir: projectRoot,
    define: { __SOCKET_ENABLED__: JSON.stringify(!!(env.VITE_SOCKET_URL || env.VITE_API_URL)) },
    server: { proxy: { "/__invoke": "http://localhost:8000" } }
  };
});
```

## Offline handling

`apiFetch` and a well-written controller return `{ ok: false, offline: true }` on a network error instead of throwing, so the UI can branch:

```ts
const res = await wallet.loadBalance(token);
if (res.offline) showBanner("Server unreachable — using cached balance");
```

Nothing is queued automatically. For the wallet example, decide the policy for a run that cannot verify the balance: block it, or allow it against a **cached last-known balance** stored locally in SQLite. See [UI → Offline & online](./ui#offline--online) for the `navigator.onLine` patterns.

## Testing the controller

Backend handlers are tested with Vitest (the UI is excluded). Mock `fetch` and assert the URL, method and envelope:

```ts
// ./src/modules/wallet/__tests__/api.controller.test.ts

import { afterEach, expect, it, vi } from "vitest";
import { balance } from "@/modules/wallet/controllers/api.controller";

const orig = globalThis.fetch;
afterEach(() => { globalThis.fetch = orig; process.env.API_URL = ""; });

it("calls the balance endpoint with a bearer token", async () => {
  process.env.API_URL = "http://localhost:3000";
  const spy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { balance: 5 } }) }));
  globalThis.fetch = spy as any;

  const res = await balance("tok");
  expect(res).toMatchObject({ ok: true, status: 200 });
  expect(spy).toHaveBeenCalledWith(
    "http://localhost:3000/api/wallet/balance",
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) })
  );
});
```

## Alternative: renderer axios

If you specifically want nexwire's axios-in-the-store style — and you accept the trade-offs above — you can keep a renderer-side axios client. Add the plugin and enable the Vite dev proxy:

```ts
// ./src/ui/src/plugins/axios.ts

import axios from "axios";

if (import.meta.env.VITE_API_URL) axios.defaults.baseURL = import.meta.env.VITE_API_URL;
axios.defaults.withCredentials = true;
axios.defaults.headers.common.Accept = "application/json";
axios.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401) window.location.hash = "#/login";
    return Promise.reject(error);
  }
);

export default axios;
```

```ts
// ./src/ui/vite.config.ts — forward same-origin /api to the server in dev
server: {
  proxy: { "/api": { target: "http://localhost:3000", changeOrigin: true } }
}
```

With `VITE_API_URL=` empty the renderer calls relative `/api/...`, which the dev proxy forwards — same-origin, so cookies and CORS are a non-issue **in dev**. In a packaged `file://` build there is no proxy, so you must bake an absolute URL and solve the third-party-cookie problem. That is why the main-process route is the default.

## See also

- [Controllers & Bindings](./controllers) — how handlers become `bindings`.
- [UI (Vue 3)](./ui) — stores, `bindings`, offline.
- [Realtime (Pulse)](./realtime) — server-pushed events and the socket URL.
- [Environment](./environment) — `.env`, runtime vs build-time.
