# UI (Vue + Vite)

The **default** frontend is a **Vue 3** single-page app built with **Vite**, styled with **Bootstrap 5** (CSS + JS + icons) on top of a custom **dark SCSS** theme, loaded from `src/ui/dist` by the Electron main process. It's a plain static SPA — you can replace it with any other frontend (see [Changing the frontend](#changing-the-frontend)).

## Stack

- Vue 3 (`createApp`) mounted into `src/ui/index.html`
- TypeScript SFCs, Vite + `@vitejs/plugin-vue`
- Bootstrap 5 (CSS + JS bundle) + Bootstrap Icons + custom SCSS at `src/ui/src/assets/scss/custom.scss` (dark dashboard theme by default)
- Axios, Vue Router, Pinia, `@unhead/vue` (document title/meta), socket.io-client and Playwright are declared in `package.json` — Pinia and `@unhead/vue` are already installed in `app.ts`, the rest are usable on demand
- **gum** (`src/ui/src/plugins/gum.ts`) — Inertia-style request/form helpers over the `bindings` global **or** HTTP/axios, plus the `DataTable` component — see [gum (Requests & Forms)](./gum)

## Entrypoints

- `src/ui/src/app.ts` — createApp, Bootstrap + SCSS imports, sets the favicon from `@/ui/assets/images/favicon/favicon.ico`, installs `@unhead/vue` (document head), Pinia, Router, Pulse, Gum
- `src/ui/src/bindings.d.ts` — types the global `bindings`
- `src/ui/src/router/index.ts` — Vue Router (dashboard route at `/`)
- `src/ui/src/pages/**` — routed pages (the starter dashboard lives in `pages/dashboard/index.vue`)
- `src/ui/src/components/**` — components for your app (includes `datatable/`, plus `Button`, `Input`, `Checkbox` used by it)
- `src/ui/src/stores/**` — Pinia stores (`defineStore`)

## App plugins: state & document head

`src/ui/src/app.ts` installs the shared app plugins, so pages use them with no extra wiring:

```ts
import { createHead } from "@unhead/vue/client";
import { createPinia } from "pinia";
import { createApp } from "vue";

createApp(App)
  .use(createHead())   // @unhead/vue — document title / meta
  .use(createPinia())  // Pinia — defineStore()
  .use(PulsePlugin)    // realtime (see guide/realtime)
  .use(GumPlugin)      // requests & forms (see guide/gum)
  .use(router)
  .mount("#app");
```

### Pinia stores

Define a store with `defineStore` and use it from any component setup:

```ts
// ./src/ui/src/stores/users.ts

import { defineStore } from "pinia";
import { ref } from "vue";

export const useUsers = defineStore("users", () => {
  const rows = ref<Array<{ id: number; name: string }>>([]);
  async function load() {
    // backend work goes through the in-process binding, not HTTP
    const res = await bindings["users.users.index"]();
    rows.value = (res as { data: Array<{ id: number; name: string }> }).data;
  }
  return { rows, load };
});
```

```vue
<script setup lang="ts">
import { useUsers } from "@/ui/stores/users";
const users = useUsers();
await users.load();
</script>
```

> `useGum()` reads the router (`useRouter`/`useRoute`), so call it inside a component setup, not at module scope or from a store action. A store that needs a request calls the binding directly (above), or accepts a `fetcher` (`useGum(...).form.postWith({ fetcher })`). `pulse` is a plain singleton, so it can be imported into a store as-is.

### Document title & meta (`useHead`)

The backend can set the window title (`app.window.setTitle`), but `@unhead/vue` lets any page drive `document.title` and `<meta>`/`<link>` tags from the renderer. Electron mirrors `document.title` to the native window title, so `useHead` is the per-page way to do it:

```vue
<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { ref } from "vue";

const title = ref("Users");
useHead({ title: () => `${title.value} · Deskapp` });
</script>
```

`useHead` accepts `title`, `titleTemplate`, `meta`, `link`, `script`, and more. Use `useHeadSafe` when the values come from untrusted input.

## The `bindings` global

The backend registers every controller handler on the window at boot; the webview calls them in-process. Binding names follow `<module>.<controller>.<handler>`:

```ts
await bindings['<module>.<controller>.setTitle']('Hello');

const report = await bindings['<module>.<controller>.list']();      // e.g. a folder picker in a backend handler
const result = await bindings['<module>.<controller>.submit'](
  { items: ['a', 'b', 'c'], concurrency: 2 }                        // -> any JSON-able result
);
```

Every handler you export from a controller becomes callable here — no network, no HTTP, no extra wiring (see [Controllers & Bindings](./controllers)).

`bindings` exists only inside the Electron renderer (the preload script exposes it). During plain `vite` dev in a browser tab it's undefined — guard calls, or rely on the dev proxy below.

## Vite dev proxy

For browser-based UI development, `src/ui/vite.config.ts` proxies a backend HTTP route:

```
/__invoke     → http://localhost:8000
```

There is no HTTP backend in the desktop build — the proxy is a placeholder so a future "call backend from a browser tab" flow can be added. The desktop app talks exclusively via in-process bindings.

## Offline & online

The desktop app's backend is **in-process**: `bindings` run in the same Electron process as the UI, so `bindings["<module>.<controller>.<handler>"]()` keeps working with **no network at all**. Database, files, native APIs, queue and cron are local and unaffected offline. Only what leaves the machine needs connectivity:

| Call                                                    | Offline behavior                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `bindings` (gum's auto-detected transport)              | Works — in-process IPC, no network                                               |
| gum `"http"` transport (axios)                          | Fails — no retry/queue built in                                                  |
| `pulse` (Socket.IO)                                     | Auto-reconnects; events emitted while offline are lost unless the engine replays |

Neither gum nor pulse checks `navigator.onLine` or queues requests, so **you** decide the offline UX:

```ts
window.addEventListener("online", () => pulse.connect());
window.addEventListener("offline", () => pulse.disconnect());

if (!navigator.onLine) {
  // show an offline banner, skip HTTP calls, ...
}
```

For HTTP retries, use gum's `onError` hook and re-issue the request when the browser fires `online`. Prefer the `bindings` transport for anything that can run in-process — it is the offline-friendly path by design. See [Realtime → Offline & reconnects](./realtime#offline-reconnects).

## Icons

- The **webview favicon** is bundled inside the UI at `src/ui/src/assets/images/favicon/favicon.ico` and set by `src/ui/src/app.ts`.
- `src/icons/` keeps the **desktop** icons at the project root — the OS taskbar/dock/window icon set referenced by electron-builder's `build.{win,mac,linux}.icon` in `package.json`, plus the tray icon. Vite's `server.fs.allow` is widened to the project root so files at the repo root can be served during dev.

## Build

```sh
npm run dev              # Vite dev server (HMR) + esbuild watch for main/preload + Electron
npm run build            # Vite build → src/ui/dist, then esbuild main/preload bundles
```

In dev, `src/main.ts` loads the renderer from the Vite dev server (`http://localhost:5173` + the preset's `route`) and Vite's HMR reloads it on every edit — no manual refresh. In a packaged build it loads `src/ui/dist/index.html` via `loadFile` (`app.getAppPath()/src/ui/dist/index.html`), so the SPA must be built first (`npm run build`). `npm run start` runs the built app against that folder.

If no UI is built, set `DESKAPP_UI=false` for headless/tray mode (see [No UI — run headless](#no-ui--run-headless)).

## Changing the frontend

Vue is only the **default** — the backend never imports your UI code. It needs exactly three things from the frontend:

1. a **static build** in `src/ui/dist` (an `index.html` plus assets), loaded by the main process;
2. the in-process **`bindings`** global mounted into the webview at boot — a runtime `Proxy`, therefore completely framework-agnostic;
3. nothing else — windows just load SPA routes (e.g. `route: "/"` in `src/config/winsetup.ts`).

So any frontend that compiles to a static single-page app works (React, Svelte, Solid, vanilla TS, ...). These are the files that define the contract:

### File inventory

| File                                                       | What it controls                                                                                                                            | When you switch                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/ui/vite.config.ts`                                    | Vite plugins, aliases, dev server, build output                                                                                             | **Keep.** Swap `plugins: [vue()]` for your framework's plugin; keep the `@`/`@/ui` aliases, `server.fs.allow` (shared `src/icons/`), `server.proxy`, and `build.outDir: "dist"`. |
| `src/ui/tsconfig.json`                                     | `@/ui/*` → `./src/*` alias, `moduleResolution: "bundler"`, `noEmit`                                                                         | **Keep** — paths are a convention, not Vue-specific.                                                                                                                             |
| `src/ui/index.html`                                        | SPA shell (`<div id="app">` + module script)                                                                                                | **Keep** the shell; repoint the script at your entry (e.g. `/src/app.tsx`).                                                                                                      |
| `src/ui/src/bindings.d.ts`                                 | Types the runtime `bindings` global                                                                                                         | **Keep** — independent of your framework.                                                                                                                                        |
| `src/ui/src/vite-env.d.ts`                                 | Vite client types                                                                                                                           | **Keep.**                                                                                                                                                                        |
| `src/ui/src/app.ts`                                        | `createApp(App).use(...).mount('#app')`                                                                                                     | **Replace** with your framework's mount code.                                                                                                                                    |
| `src/ui/src/App.vue`, `components/`                        | Vue demo UI                                                                                                                                 | **Replace** with your components.                                                                                                                                                |
| `src/ui/src/plugins/pulse.ts`                              | Realtime socket bridge (a Vue plugin)                                                                                                       | **Replace** with your framework's equivalent if you use realtime.                                                                                                                |
| `src/ui/src/plugins/gum.ts`                                | Requests & forms (bindings or HTTP) + the `DataTable` component                                                                             | **Replace** with your framework's data-fetching layer, or keep both and call the backend via `bindings` anyway.                                                                  |
| `src/ui/.vscode/extensions.json`                           | Recommends `Vue.volar`                                                                                                                      | Update to your framework's editor extension.                                                                                                                                     |
| `src/ui/public/`                                           | Static assets copied verbatim into `dist`                                                                                                   | Keep / extend.                                                                                                                                                                   |
| `package.json` → `devDependencies`                         | Pins `vite`, `@vitejs/plugin-vue`, `vue`, `bootstrap`, `bootstrap-icons`, `sass-embedded`, `axios`, `pinia`, `vue-router`, `@unhead/vue`, `lodash-es`, ... | Add/remove your framework's packages here.                                                                                                                                       |
| `package.json` → `scripts` (`dev:ui`, `build:ui`, `dev`, `build`) | Run the Vite build                                                                                                                   | **Keep** — they just invoke `vite`; only edit if you leave Vite.                                                                                                                 |
| `src/main.ts`                                              | `loadFile(src/ui/dist/index.html)` (dev: `loadURL(localhost:5173)`)                                                                         | **Keep** — never framework-dependent.                                                                                                                                            |
| `.env` / `.env.example`                                    | `DESKAPP_UI`, `VITE_SOCKET_URL`, `VITE_API_URL`                                                                                             | Keep; `DESKAPP_UI=false` disables the UI at runtime.                                                                                                                             |

### Reference — full file contents

Switching frontends replaces the files below. The copy-paste-safe originals are reproduced here so the backend contract can be re-created exactly:

**`src/ui/vite.config.ts`** — as shipped:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const rootDir = typeof import.meta.dirname === "string"
  ? import.meta.dirname
  : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Use path.resolve for bulletproof Windows support
  root: path.resolve(rootDir, "."),
  plugins: [vue()],
  base: "./",
  define: {
    __SOCKET_ENABLED__: JSON.stringify(!!process.env.VITE_SOCKET_URL || !!process.env.VITE_API_URL),
  },
  resolve: {
    alias: {
      "@/ui": path.resolve(rootDir, "./src"),
      "@": path.resolve(rootDir, "../../src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(rootDir, "../..")],
    },
    proxy: {
      "/__invoke": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

Keep the `define` block (realtime flag), both aliases, `server.fs.allow` and `server.proxy`, and `build.outDir: "dist"`. Only `plugins: [vue()]` changes per framework (→ `react()`, `svelte()`, or nothing for vanilla).

> Tip: the aliases and `server.fs.allow` resolve paths with `fileURLToPath`, **not** `new URL(...).pathname`. `.pathname` keeps URL percent-encoding (`%20` for spaces), which breaks Vite on any project path containing a space — `fileURLToPath` returns a real filesystem path.

**`src/ui/tsconfig.json`** — as shipped:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": {
      "@/ui/*": ["./src/*"],
      "@/*": ["../../src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

Keep `paths` (`@/ui/*` → `./src/*`) and `include`; add framework-specific options (e.g. `"jsx": "react-jsx"`).

**`src/ui/src/plugins/pulse.ts`** — as shipped (full):

```ts
import { io, type Socket } from "socket.io-client";
import type { App } from "vue";

declare const __SOCKET_ENABLED__: boolean;

type EventCallback<T = unknown> = (payload: T) => void;

// Access token (or a getter returning one) sent with the Socket.IO handshake.
// The desktop client cannot send the httpOnly auth cookie, so the server reads
// this bare JWT from `handshake.auth.token`. A getter is preferred because it
// is resolved on every (re)connect.
export type PulseToken = string | null | (() => string | null);

type ChannelBinding = {
  event: string;
  callback: EventCallback;
  wrapped: EventCallback;
};

type PulseChannel = {
  listen: <T = unknown>(event: string, callback: EventCallback<T>) => PulseChannel;
  stopListening: (event: string, callback?: EventCallback) => PulseChannel;
};

export type PulseClient = {
  connect: () => PulseClient;
  disconnect: () => PulseClient;
  setToken: (token: PulseToken) => PulseClient;
  channel: (name: string) => PulseChannel;
  private: (room: string) => PulseChannel;
  leave: (room: string) => PulseClient;
};

function createPulse(): PulseClient {
  if (!__SOCKET_ENABLED__) {
    const n = (): PulseChannel => ({ listen: () => n(), stopListening: () => n() });
    const c: PulseClient = {
      connect: () => c,
      disconnect: () => c,
      setToken: () => c,
      channel: n,
      private: n,
      leave: () => c,
    };
    return c;
  }

  let socket: Socket | null = null;
  let tokenSource: PulseToken = null;
  const channels = new Map<string, ChannelBinding[]>();
  const joinedRooms = new Set<string>();

  // Resolve lazily so every reconnect picks up the current token.
  const resolveToken = () => (typeof tokenSource === "function" ? tokenSource() : tokenSource);

  const socketUrl = () => {
    const explicit = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
    if (explicit) return explicit;
    return window.location.origin;
  };

  const ensureConnected = () => {
    if (socket) return socket;

    socket = io(socketUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: (callback) => {
        const token = resolveToken();
        callback(token ? { token } : {});
      },
    });

    socket.on("connect", () => {
      for (const room of joinedRooms) {
        socket?.emit("join", room);
      }
    });

    return socket;
  };

  const channel = (name: string): PulseChannel => {
    const room = String(name).trim();
    if (!room) throw new Error("Channel name is required");

    const currentSocket = ensureConnected();
    joinedRooms.add(room);
    currentSocket.emit("join", room);

    const api: PulseChannel = {
      listen: <T = unknown>(event: string, callback: EventCallback<T>) => {
        const wrapped = (payload: unknown) => callback(payload as T);
        const bindings = channels.get(room) || [];
        bindings.push({ event, callback: callback as EventCallback, wrapped });
        channels.set(room, bindings);
        currentSocket.on(event, wrapped);
        return api;
      },
      stopListening: (event: string, callback?: EventCallback) => {
        const bindings = channels.get(room) || [];
        const kept: ChannelBinding[] = [];

        for (const binding of bindings) {
          const matchesEvent = binding.event === event;
          const matchesCallback = !callback || binding.callback === callback;
          if (matchesEvent && matchesCallback) {
            currentSocket.off(binding.event, binding.wrapped);
          } else {
            kept.push(binding);
          }
        }

        if (kept.length > 0) channels.set(room, kept);
        else channels.delete(room);
        return api;
      },
    };

    return api;
  };

  const pulse: PulseClient = {
    connect: () => {
      ensureConnected();
      return pulse;
    },
    disconnect: () => {
      socket?.disconnect();
      socket = null;
      return pulse;
    },
    setToken: (token: PulseToken) => {
      tokenSource = token;
      if (socket) {
        // Force a new handshake with the updated credentials. The connect
        // handler re-joins every room in joinedRooms.
        socket.disconnect().connect();
      }
      return pulse;
    },
    channel,
    private: (room: string) => channel(`private:${room}`),
    leave: (room: string) => {
      const name = String(room).trim();
      if (!name) return pulse;

      joinedRooms.delete(name);
      const bindings = channels.get(name) || [];
      channels.delete(name);

      if (socket) {
        // Tell the server too: dropping listeners alone leaves the socket
        // subscribed and still receiving that room's events.
        socket.emit("leave", name);
        for (const binding of bindings) {
          socket.off(binding.event, binding.wrapped);
        }
      }

      return pulse;
    },
  };

  return pulse;
}

export const pulse = createPulse();

export const PulsePlugin = {
  install(app: App) {
    app.config.globalProperties.$pulse = pulse;
  },
};

declare module "vue" {
  interface ComponentCustomProperties {
    $pulse: PulseClient;
  }
}
```

The socket client (`createPulse` → the exported `pulse` singleton) is framework-agnostic. Only the bottom three pieces are Vue-specific — the `import type { App } from "vue"`, the `PulsePlugin` install block, and the `declare module "vue"` augmentation. If your new UI keeps realtime, copy the client and swap those three for your framework's equivalent.

### Switch to another Vite framework (e.g. React)

1. `package.json` → `devDependencies`: add your framework's Vite plugin (e.g. `@vitejs/plugin-react`), keep `vite`. Drop `vue` / `@vitejs/plugin-vue` once nothing imports them.
2. `src/ui/vite.config.ts`: set `plugins: [react()]` instead of `[vue()]`. Leave aliases, `server.fs.allow`, `server.proxy`, and `build.outDir: "dist"` untouched.
3. Replace `src/ui/src/app.ts` (→ `app.tsx`) with your framework's mount, and `App.vue` / `components/` with your components.
4. `src/ui/index.html`: change the `/src/app.ts` script tag to `/src/app.tsx`.
5. `src/ui/tsconfig.json`: keep the paths; add framework options like `"jsx": "react-jsx"` if needed.
6. Run `npm run build` and confirm `src/ui/dist/index.html` regenerates, then `npm run dev`.

`bindings` keeps working identically — it's a `Proxy`, not a Vue API.

### Non-Vite build tooling

If the build still lands a static `index.html` at `src/ui/dist`, you can bring any tool:

- The `build:ui` script (`vite build --config src/ui/vite.config.ts`) runs your builder; point it at the `src/ui/dist` output.
- Keep the output directory `src/ui/dist` — that's the path `src/main.ts` loads (`app.getAppPath()/src/ui/dist/index.html`). If you move it, update `getRendererIndexPath()` in `src/main.ts`.

### No UI — run headless

- At runtime: set `DESKAPP_UI=false` in `.env`. No window opens; the process runs as a tray service (`chrome.createHeadlessTray()`).
- For shipped builds: skip `build:ui` (or ship with `DESKAPP_UI=false`) and package with `npm run package`; the app starts headless with the tray. See [Build & Package](../cli/bundle).