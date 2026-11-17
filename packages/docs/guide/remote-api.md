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

## The one helper: `http` (from the facade)

Every remote call goes through **`http`**, a small axios-based helper exported from the framework facade. Import it once and use it — no `fetch`, no `JSON.stringify`, no `res.json()`:

```ts
import { http } from "@/core/facade";

// in a controller, job, schedule, or any main-process code
const res = await http.get("/api/wallet/balance", { token });
if (!res.ok) return res;   // { ok: false, offline: true } when the server is unreachable
console.log(res.data);     // the parsed JSON body
```

| Call | What it does |
| --- | --- |
| `http.get(path, options?)` | `GET` |
| `http.post` / `http.put` / `http.patch` / `http.delete` | the matching verb |
| `http.request(path, options)` | any method (`options.method`) |
| `http.baseUrl()` | the runtime `API_URL` (or `""`) |
| `http.client` | the raw axios instance (interceptors, `defaults`) |

`options` is `{ body?, token?, headers?, query?, timeout? }`:

- `body` — an object is JSON-encoded and `Content-Type` set for you.
- `token` — sets `Authorization: Bearer <token>` (unless you pass that header yourself).
- `query` — query-string params.

Three things it does so you don't have to:

- **Absolute URLs pass through.** `http.get("https://other.example/x")` ignores the base.
- **The scheme is filled in.** `API_URL=localhost:3000` → `http://localhost:3000`; `API_URL=wallet.example.com` → `https://wallet.example.com`.
- **It never throws.** A network failure returns `{ ok: false, offline: true }` — branch, don't catch.

See the [`http` API reference](../api/http) for the full surface.

### The shipped binding (`app.net`)

The UI can't import the facade — the renderer never imports backend code — so the template also exposes `http` as bindings through `src/modules/app/controllers/net.controller.ts`:

| Binding | Signature | Purpose |
| --- | --- | --- |
| `app.net.apiBase` | `() => { ok, url, configured }` | Reports the runtime `API_URL`. |
| `app.net.apiFetch` | `(path, init?) => { ok, status, data, offline?, error? }` | The same call as `http.request`, for the renderer. |
| `app.net.fetchJson` | `(url) => { ok, status, data }` | Fetches any absolute `http(s)` URL as text/JSON. |
| `app.net.placeholder` | `() => { ... }` | One-click JSONPlaceholder demo. |

`net.controller.ts` is a thin wrapper — it only re-exposes `http`. You can try it live from the dashboard **Network** card (`API base` / `API fetch` buttons).

> **Which do I use?** Main-process code (controllers, jobs, schedules) → `http` from the facade. Renderer code (pages, stores) → a binding: the generic `app.net.apiFetch`, or your own module controller (see the walkthrough).

## Configure the base URL (`API_URL`)

The base URL comes from `.env` at the **project root**, read by the main process at boot (`src/main.ts` → `loadEnv()`), so changing it needs no rebuild:

```sh
# .env
API_URL=http://localhost:3000        # dev
# API_URL=https://wallet.example.com # production
```

Leave it empty to run fully offline — a relative call then returns `{ ok: false, offline: true }`.

> `VITE_API_URL` / `VITE_SOCKET_URL` are a **different** pair: they are Vite build-time variables for the renderer bundle (the dev proxy and the Pulse socket). See [Dev vs production](#dev-vs-production). For a server call, always use `API_URL`.

## Calling from a module

If the call happens in the **main process** — a controller handler, a queued job, a schedule, an automation step — you don't need a binding at all:

```ts
import { http } from "@/core/facade";

const res = await http.get("/api/wallet/balance", { token });
```

The base URL is read from `API_URL` on every call, so the same code works in dev and production. If the result must reach the **UI**, wrap it in a controller with a `handlers` map (the walkthrough below) — the renderer then calls it through `bindings`.

## Walkthrough: a wallet module

Say your server exposes `POST /api/auth/login` and `GET /api/wallet/balance`, and you want the desktop to show the balance before each automation run.

### 1. Scaffold the module

```sh
npm run maker -- make:module wallet
npm run maker -- bindings:gen      # register the new controller
```

(For a pure API proxy with no model, `npm run maker -- make:controller wallet api` on an existing module is enough.)

### 2. Write the controller

A handler that calls the server is one line — `http` does the rest:

```ts
// ./src/modules/wallet/controllers/api.controller.ts

import { http, validate } from "@/core/facade";
import { LoginSchema } from "@/modules/wallet/controllers/api.schema";

export const login = async (body: unknown) => {
  const data = await validate.run(LoginSchema, body);
  return http.post("/api/auth/login", { body: data });
};

export const me = (token: string) => http.get("/api/auth/me", { token });

export const balance = (token: string) => http.get("/api/wallet/balance", { token });

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { login, me, balance };
```

This creates `wallet.api.login`, `wallet.api.me` and `wallet.api.balance`. Each
returns the same envelope (`{ ok, status, data, offline?, error? }`), so the store
in step 3 branches instead of catching.

> No controller needed? For a one-off call the UI can use the shipped
> `app.net.apiFetch` binding directly. A dedicated controller is worth it when you
> want validation, a typed surface, or to hide token handling from the UI.

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

## Testing a server call

Backend handlers are tested with Vitest (the UI is excluded). Spy on the shared
axios instance and assert the URL, method and envelope:

```ts
// ./src/modules/wallet/__tests__/api.controller.test.ts

import { afterEach, expect, it, vi } from "vitest";
import { http } from "@/core/facade";
import { balance } from "@/modules/wallet/controllers/api.controller";

afterEach(() => {
  process.env.API_URL = "";
  vi.restoreAllMocks();
});

it("calls the balance endpoint with a bearer token", async () => {
  process.env.API_URL = "http://localhost:3000";
  const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: { data: { balance: 5 } } } as any);

  const res = await balance("tok");
  expect(res).toMatchObject({ ok: true, status: 200 });
  expect(spy).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "http://localhost:3000/api/wallet/balance",
      headers: expect.objectContaining({ Authorization: "Bearer tok" })
    })
  );
});
```

The template ships both halves of this: `src/core/utils/http.test.ts` covers the
helper, and `src/modules/app/__tests__/net.controller.test.ts` covers the binding.

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
