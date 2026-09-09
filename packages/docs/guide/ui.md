# UI (Vue + Vite)

The **default** frontend is a **Vue 3** single-page app built with **Vite**, styled with **Bootstrap 5** (CSS + JS + icons) on top of a custom **dark SCSS** theme, served from `src/ui/dist` by the Deno backend running under `deno desktop`. It's a plain static SPA — you can replace it with any other frontend (see [Changing the frontend](#changing-the-frontend)).

## Stack

- Vue 3 (`createApp`) mounted into `src/ui/index.html`
- TypeScript SFCs, Vite + `@vitejs/plugin-vue`
- Bootstrap 5 (CSS + JS bundle) + Bootstrap Icons + custom SCSS at `src/ui/src/assets/scss/custom.scss` (dark dashboard theme by default)
- Axios, Vue Router, Pinia, socket.io-client and Playwright are declared in the root import map — usable on demand

## Entrypoints

- `src/ui/src/app.ts` — createApp, Bootstrap + SCSS imports, sets the favicon from `@/ui/assets/images/favicon/favicon.ico`
- `src/ui/src/bindings.d.ts` — types the global `bindings`
- `src/ui/src/components/**` — the components you write for your app

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

`bindings` exists only under `deno desktop`. During plain `vite` dev (browser tab) it's undefined — guard calls, or rely on the Dev Proxy below.

## Vite dev proxy

For browser-based UI development, `src/ui/vite.config.ts` proxies backend HTTP routes:

```
/__invoke     → http://localhost:8000
/__bindings   → http://localhost:8000
```

These proxy targets are not implemented by the backend yet — they exist so a future "call backend from browser" flow can be added. The desktop build talks exclusively via in-process bindings.

## Icons

- The **webview favicon** is bundled inside the UI at `src/ui/src/assets/images/favicon/favicon.ico` and set by `src/ui/src/app.ts`.
- `src/icons/` keeps the **desktop** icons at the project root — the OS taskbar/dock/window icon set referenced by `deno.json` → `desktop.app.icons`, plus the tray icon. Vite's `server.fs.allow` is widened to the project root so files at the repo root can be served during dev.

## Build

```sh
deno task maker dev      # vite build → src/ui/dist, then `deno desktop --hmr` (+ a vite watch build)
deno task maker build    # vite build → src/ui/dist, then a `deno desktop` package
```

The backend serves `src/ui/dist` with `serveDir` from `@std/http/file-server` (`src/main.ts`), resolving it from the binary's virtual filesystem in packaged builds and from disk in dev. If no UI is built, `src/main.ts` serves a small JSON status instead (headless/tray mode).

`dev` runs an extra `vite build --watch` in the background and sets `FRONTEND_WATCH=1`; the backend then watches `src/ui/dist` (`win.watchFrontend`) and reloads the open window whenever a rebuild lands — so editing SCSS/Vue files shows up in the desktop window without a manual refresh.

## Changing the frontend

Vue is only the **default** — the backend never imports your UI code. It needs exactly three things from the frontend:

1. a **static build** in `src/ui/dist` (an `index.html` plus assets), served for every route by `serveDir`;
2. the in-process **`bindings`** global mounted into the webview at boot — a runtime `Proxy`, therefore completely framework-agnostic;
3. nothing else — windows just navigate to SPA routes (e.g. `route: "/"` in `src/window/config.ts`).

So any frontend that compiles to a static single-page app works (React, Svelte, Solid, vanilla TS, ...). These are the files that define the contract:

### File inventory

| File | What it controls | When you switch |
| --- | --- | --- |
| `src/ui/vite.config.ts` | Vite plugins, aliases, dev server, build output | **Keep.** Swap `plugins: [vue()]` for your framework's plugin; keep the `@`/`@/ui` aliases, `server.fs.allow` (shared `src/icons/`), `server.proxy`, and `build.outDir: "dist"`. |
| `src/ui/tsconfig.json` | `@/ui/*` → `./src/*` alias, `moduleResolution: "bundler"`, `noEmit` | **Keep** — paths are a convention, not Vue-specific. |
| `src/ui/index.html` | SPA shell (`<div id="app">` + module script) | **Keep** the shell; repoint the script at your entry (e.g. `/src/app.tsx`). |
| `src/ui/src/bindings.d.ts` | Types the runtime `bindings` global | **Keep** — independent of your framework. |
| `src/ui/src/vite-env.d.ts` | Vite client types | **Keep.** |
| `src/ui/src/app.ts` | `createApp(App).use(...).mount('#app')` | **Replace** with your framework's mount code. |
| `src/ui/src/App.vue`, `components/` | Vue demo UI | **Replace** with your components. |
| `src/ui/src/plugins/pulse.ts` | Realtime socket bridge (a Vue plugin) | **Replace** with your framework's equivalent if you use realtime. |
| `src/ui/.vscode/extensions.json` | Recommends `Vue.volar` | Update to your framework's editor extension. |
| `src/ui/public/` | Static assets copied verbatim into `dist` | Keep / extend. |
| `deno.json` → `imports` | Pins `vite`, `@vitejs/plugin-vue`, `vue`, `bootstrap`, `bootstrap-icons`, `sass-embedded`, `axios`, `pinia`, `vue-router`, ... | Add/remove your framework's packages here (`npm:`). |
| `deno.json` → `tasks` (`ui`, `build:ui`, `dev`, `build:*`) | Run the Vite build | **Keep** — they just invoke `vite`; only edit if you leave Vite. |
| `src/main.ts` | `resolveDistPath()` → `serveDir` of `src/ui/dist` | **Keep** — never framework-dependent. |
| `.env` / `.env.example` | `DESKAPP_UI`, `VITE_SOCKET_URL`, `VITE_API_URL` | Keep; `DESKAPP_UI=false` disables the UI at runtime. |

### Reference — full file contents

Switching frontends replaces the files below. The copy-paste-safe originals are reproduced here so the backend contract can be re-created exactly:

**`src/ui/vite.config.ts`** — as shipped:

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  define: {
    __SOCKET_ENABLED__: JSON.stringify(
      !!process.env.VITE_SOCKET_URL || !!process.env.VITE_API_URL
    ),
  },
  resolve: {
    alias: {
      "@/ui": new URL("src/", import.meta.url).pathname,
      "@": new URL("src/", import.meta.url).pathname,
    },
  },
  server: {
    // Allow serving the shared icon folder at the project root (src/icons)
    // alongside the ui package root.
    fs: {
      allow: [new URL("../..", import.meta.url).pathname],
    },
    proxy: {
      "/__invoke": "http://localhost:8000",
      "/__bindings": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

Keep the `define` block (realtime flag), both aliases, `server.fs.allow` and `server.proxy`, and `build.outDir: "dist"`. Only `plugins: [vue()]` changes per framework (→ `react()`, `svelte()`, or nothing for vanilla).

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
      "@/ui/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src/**/*"
  ]
}
```

Keep `paths` (`@/ui/*` → `./src/*`) and `include`; add framework-specific options (e.g. `"jsx": "react-jsx"`).

**`src/ui/src/plugins/pulse.ts`** — as shipped (full):

```ts
import { io, type Socket } from "socket.io-client";
import type { App } from "vue";

declare const __SOCKET_ENABLED__: boolean;

type EventCallback<T = unknown> = (payload: T) => void;

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
      channel: n,
      private: n,
      leave: () => c,
    };
    return c;
  }

  let socket: Socket | null = null;
  const channels = new Map<string, ChannelBinding[]>();
  const joinedRooms = new Set<string>();

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
    channel,
    private: (room: string) => channel(`private:${room}`),
    leave: (room: string) => {
      if (!socket) return pulse;

      const bindings = channels.get(room) || [];
      for (const binding of bindings) {
        socket.off(binding.event, binding.wrapped);
      }

      channels.delete(room);
      joinedRooms.delete(room);
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

1. `deno.json` → `imports`: add your framework's Vite plugin (e.g. `@vitejs/plugin-react`), keep `vite`. Drop `vue` / `@vitejs/plugin-vue` once nothing imports them.
2. `src/ui/vite.config.ts`: set `plugins: [react()]` instead of `[vue()]`. Leave aliases, `server.fs.allow`, `server.proxy`, and `build.outDir: "dist"` untouched.
3. Replace `src/ui/src/app.ts` (→ `app.tsx`) with your framework's mount, and `App.vue` / `components/` with your components.
4. `src/ui/index.html`: change the `/src/app.ts` script tag to `/src/app.tsx`.
5. `src/ui/tsconfig.json`: keep the paths; add framework options like `"jsx": "react-jsx"` if needed.
6. Run `deno task maker build` and confirm `src/ui/dist/index.html` regenerates, then `deno task dev`.

`bindings` keeps working identically — it's a `Proxy`, not a Vue API.

### Non-Vite build tooling

If the build still lands a static `index.html` at `src/ui/dist`, you can bring any tool:

- The `vite build` step (in `src/core/maker/run/mod.ts`) runs your builder; point it at `src/ui/dist` output.
- Keep the output directory `src/ui/dist` — that's the hard-coded path the backend checks in `resolveDistPath()`. If you move it, add your new path to that candidate list in `src/main.ts`.

### No UI — run headless

- At runtime: set `DESKAPP_UI=false` in `.env`. No window opens; the process runs as a tray service and the HTTP server returns a small JSON status.
- For shipped builds: run `deno task maker bundle:win --ui=skip` to bundle with no UI embedded. Use `--ui=force` to fail the build if the UI is missing. See [Bundle](../cli/bundle).