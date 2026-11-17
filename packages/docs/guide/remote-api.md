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

import { http, session, validate } from "@/core/facade";
import { LoginSchema } from "@/modules/wallet/controllers/api.schema";

const TOKEN = "walletToken";

export const login = async (body: unknown) => {
  const data = await validate.run(LoginSchema, body);
  const res = await http.post("/api/auth/login", { body: data });
  const payload = (res.data as { data?: { access_token?: string; user?: unknown } } | null)?.data;
  if (res.ok && payload?.access_token) session.set(session.DEFAULT, TOKEN, payload.access_token);
  // Return the user, never the tokens — the renderer has no business seeing them.
  return { ok: res.ok, status: res.status, user: payload?.user ?? null, offline: res.offline, error: res.error };
};

export const me = () => http.get("/api/auth/me", { token: session.get<string>(session.DEFAULT, TOKEN) });

export const balance = () => http.get("/api/wallet/balance", { token: session.get<string>(session.DEFAULT, TOKEN) });

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { login, me, balance };
```

The token is kept in the main process, in the [`session`](../api/session) store —
it never reaches the renderer. This creates `wallet.api.login`, `wallet.api.me` and
`wallet.api.balance`. Each returns the same envelope
(`{ ok, status, data, offline?, error? }`), so the store in step 3 branches instead
of catching.

> This is the manual form. For a nexwire server you do not write it: the template
> already ships a bearer client — `app.auth.*` plus the `session`-backed
> `src/ui/src/stores/auth.ts` — see [Authentication](#authentication) below.

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
    const res = (await bindings["wallet.api.login"]({ email, password })) as {
      ok: boolean;
      user?: any;
      offline?: boolean;
      error?: string;
    };
    if (!res.ok) throw Object.assign(new Error(res.error || "Login failed"), { response: res });
    return res.user;
  }

  async function loadBalance() {
    loading.value = true;
    try {
      const res = (await bindings["wallet.api.balance"]()) as Envelope;
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

async function submit() {
  await wallet.login(email.value, password.value);
  await wallet.loadBalance();
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

The desktop app is not a browser tab: the main process has no origin, and a packaged renderer runs from `file://`, so an `httpOnly` login cookie will not stick. The template therefore ships a **bearer** auth client, pointed at a nexwire server (or any server with the same contract).

### The shipped bearer client

| Handler       | Binding           | Does                                             |
| ------------- | ----------------- | ------------------------------------------------ |
| `login(body)` | `app.auth.login`  | `POST /api/auth/login`, store the token pair     |
| `me()`        | `app.auth.me`     | `GET /api/auth/me` (refreshes silently on `401`) |
| `logout()`    | `app.auth.logout` | drop the session, best-effort revoke             |
| `status()`    | `app.auth.status` | signed-in state, no network call                 |

The controller is a thin binding surface. The actual client — the endpoints, the session keys, the header, the token shape and the two interceptors — lives in **[`src/config/auth.ts`](../api/auth)**, a file you own and edit. `src/main.ts` installs it with one import at boot:

```ts
import "@config/auth"; // bearer + refresh interceptors on http.client
```

So a brand-new module needs **no auth code**: just call `http.get` / `http.post` and the token rides along.

```ts
// ./src/modules/wallet/controllers/api.controller.ts

import { http } from "@/core/facade";

export const balance = () => http.get("/api/wallet/balance");
// -> Authorization: Bearer <stored token> is added for you,
//    and a 401 triggers one silent refresh + retry.
export const handlers = { balance };
```

The token pair lives in the core [`session`](../api/session) store **in the main process only** — encrypted at rest with Electron's `safeStorage` when available — and never crosses to the renderer. The interceptors:

- a **request** interceptor attaches `<header.scheme> <access token>` to every `http` call (it never overrides an explicit header);
- a **response** interceptor turns a `401` into one silent `POST <paths.refresh>` + retry. The server rotates the pair, so both tokens are replaced; concurrent `401`s share a single rotation.

The renderer drives it through `src/ui/src/stores/auth.ts` — the store owns only the UI state, never a token:

```ts
const auth = useAuthStore();
await auth.login(email, password); // the pair is stored in the main process
await auth.me();                   // refreshes silently on 401
auth.status();                     // signed in? no network
await auth.logout();
```

Server side, nexwire's guard reads the bearer header **before** the access cookie, and `login`/`register` return `{ access_token, refresh_token, token_type: "Bearer" }` in the body. See the nexwire [Auth guide](https://niyamulahsan.github.io/nexwire/guide/auth).

### Customizing the contract

Change token field names, endpoints, the header, or the response shape by editing **only** `src/config/auth.ts`. The `AUTH` object at the top is the whole contract:

```ts
// ./src/config/auth.ts

export const AUTH = {
  paths: { login: "/api/auth/login", refresh: "/api/auth/refresh-token", logout: "/api/auth/logout", me: "/api/auth/me" },
  keys: { access: "accessToken", refresh: "refreshToken", user: "user" },
  header: { name: "Authorization", scheme: "Bearer" },
  refreshBody: (refreshToken) => ({ refresh_token: refreshToken }),
  readTokens: (payload) => ({
    access: payload?.access_token ?? null,
    refresh: payload?.refresh_token ?? null,
    user: payload?.user ?? null
  })
};
```

Full reference: [`auth`](../api/auth).

### Logging out

`logout()` clears the local session and makes a best-effort `POST /api/auth/logout`. nexwire's shipped logout revokes the **refresh cookie**, so a bearer client's call returns `200` but does not revoke the token server-side. To revoke for real, call `POST /api/auth/logout-all` (which revokes the refresh token) before clearing the session.

### Rolling your own

Any server with a different contract follows the same shape: keep the token in [`session`](../api/session), attach it in a controller with `http.get(path, { token })`, and refresh on `401`. The walkthrough above is exactly that. More often you don't need to: change the [`AUTH`](../api/auth) contract in `src/config/auth.ts` and the shipped client follows.

### Cookie sessions

If your server is **cookie-only**, a cross-origin cookie is the problem. Two settings make it work:

- The server must mark the cookie `SameSite=None; Secure` when the API origin differs from the client origin. In nexwire that happens automatically when `FRONTEND_URL` differs from `APP_URL` (see `src/framework/support/cookie.ts`).
- The request must be credentialed. The main process `fetch` does **not** keep a browser cookie jar, so for cookie sessions use Electron's session-bound `net.fetch` instead of the global `fetch` — then the cookie persists in the Electron session.

Bearer is simpler and is what this guide recommends for a desktop client. nexwire supports both: its guard accepts the bearer header first and falls back to the access cookie for the browser SPA.

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
The auth client has its own coverage in `src/config/auth.test.ts` (the contract,
the session helpers and both interceptors), the `app.auth.*` handlers in
`src/modules/app/__tests__/auth.controller.test.ts`, and the store in
`src/core/utils/session.test.ts`.

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
