# Configuration

Most configuration lives in `deno.json`; window presets live in `src/window/config.ts`.

## deno.json

The scaffolded app ships one `deno.json` (the root `template/deno.json`) that wires **tasks**, the **import map**, the **Deno Desktop** config, `lint` and `compilerOptions`. It's a project file, not a package file — no `name`/`exports` needed unless you publish your own app:

```jsonc
{
  "tasks": {
    "maker": "deno run -A src/core/maker/mod.ts",  // CLI: make:* / db:* / build* / bundle* / dev / serve / ui
    "dev": "deno task maker dev",                  // codegen → build UI → desktop app (HMR + UI watch)
    "serve": "deno task maker serve",              // codegen → server entry (headless-aware)
    "ui": "deno task maker ui",                    // raw Vite dev server (browser tab)
    "test": "deno test -A"
  },
  "lint": {
    "exclude": ["src/ui", "src/database", "src/database/migrations", "src/storage", "src/extensions", "node_modules", "dist"]
  },
  "nodeModulesDir": "auto",
  "desktop": {
    "app": {
      "name": "Deskapp",
      "icons": {
        "macos": "./src/icons/web-app-manifest-512x512.png",
        "windows": "./src/icons/favicon.ico",
        "linux": "./src/icons/web-app-manifest-512x512.png"
      },
      "deepLinks": ["deskapp"]
    },
    "backend": "webview",
    "output": {
      "macos": "./dist/Deskapp.app",
      "windows": "./dist/Deskapp",
      "linux": "./dist/deskapp"
    }
  },
  "imports": {
    "@/": "./src/",
    "@/ui/": "./src/ui/src/",
    "@cliffy/command": "jsr:@cliffy/command@^1.2.1",
    "@libsql/client": "npm:@libsql/client@^0.18.0",
    "@std/assert": "jsr:@std/assert@1",
    "@std/dotenv": "jsr:@std/dotenv@^0.225.8",
    "@std/http": "jsr:@std/http@^1.1.3",
    "@std/path": "jsr:@std/path@^1.1.6",
    "@vitejs/plugin-vue": "npm:@vitejs/plugin-vue@^6.0.8",
    "axios": "npm:axios@^1.20.0",
    "bcryptjs": "npm:bcryptjs@^3.0.3",
    "bootstrap": "npm:bootstrap@^5.3.8",
    "bootstrap-icons": "npm:bootstrap-icons@^1.13.1",
    "croner": "npm:croner@^10.0.1",
    "drizzle-kit": "npm:drizzle-kit@^0.31.10",
    "drizzle-orm": "npm:drizzle-orm@^0.45.2",
    "pinia": "npm:pinia@^4.0.3",
    "sass-embedded": "npm:sass-embedded@^1.103.1",
    "socket.io-client": "npm:socket.io-client@^4.8.3",
    "typescript": "npm:typescript@^7.0.2",
    "vite": "npm:vite@^8.2.2",
    "vue": "npm:vue@^3.5.42",
    "vue-router": "npm:vue-router@^5.3.1",
    "zod": "npm:zod@^4.5.4"
  },
  "compilerOptions": {
    "strict": false,
    "lib": ["deno.window", "dom", "dom.iterable", "esnext"]
  }
}
```

### Key sections

- **`imports`** — the import map: `@/` → `./src/`, `@/ui/` → `./src/ui/src/`, plus every npm/jsr dependency. Add new deps with `deno add npm:something`. Note what's *not* there: **`playwright`** is deliberately absent — only the `app.playwright` demo uses it, so a scaffold starts without it. Add `"playwright": "npm:playwright@^1.61.1"` here to enable browser automation (see [Playwright & Chromium](./playwright)).
- **`desktop.app`** — display name, per-OS icon paths, deep-link schemes. This is your app identity; the bundler reads it too. The icons configured here are what **every window** shows in the taskbar/dock — Deno Desktop's `BrowserWindowOptions` has no per-window icon (see [win — Known quirks](../api/win#known-quirks-with-multiple-windows)).
- **`desktop.backend` / `desktop.output`** — backend flavor (`webview`) and per-OS output paths.
- **`lint` / `nodeModulesDir`** — what `deno lint` touches and npm node_modules handling (`auto`).
- **`compilerOptions`** — `strict: false`, with `deno.window` + DOM libs so the UI's type declarations resolve under `deno check` as well.
- **`tasks`** — see the table below.

## Tasks (deno.json)

| Task | Runs |
| --- | --- |
| `maker` | The maker CLI (run `deno task maker` for full command help): `make:*` scaffolders, `db:*` database commands, and the build/bundle codegen subcommands below. |
| `dev` | `deno task maker dev` — codegen (schema + bindings) → build UI → `deno desktop --env-file --hmr -A src/main.ts`, with a `vite build --watch` (and `FRONTEND_WATCH=1`) so UI edits reload the open window automatically |
| `serve` | `deno task maker serve` — codegen → `deno run -A --env-file src/main.ts` (headless-aware server) |
| `ui` | `deno task maker ui` — raw Vite dev server (browser tab, no `bindings`) |
| `test` | `deno test -A` |

### Maker subcommands

The heavy lifting lives in the maker CLI (one script, many subcommands), so `deno.json` stays at five thin tasks. The relevant ones here:

| Maker command | Meaning |
| --- | --- |
| `maker codegen` | `db:schema` + `bindings:gen` — regenerate the DB schema and the bindings manifest |
| `maker bindings:gen` | regenerate `src/core/api/bindings.generated.ts` |
| `maker build` / `build:win` / `build:mac` / `build:linux` | build UI then `deno desktop`, cross-compiled via `--target <triple>` |
| `maker bundle` / `bundle:win` / `bundle:mac` / `bundle:linux` | full bundle via `src/core/bundle.ts` (add `--ui=skip` for a headless server-only app) |
| `maker dev` / `serve` / `ui` | the wrappers above — same as `deno task dev` / `serve` / `ui` |

> There's no `publish` task here — `deno task maker bundle:*` cover distribution.

## Windows (`src/window/config.ts`)

Only presets declared in the `windows` map open at boot — the default template ships just `main`. Every extra native window is opened on demand with the reusable `win.openWindow()` API, passing an inline preset:

```ts
export interface WindowPreset {
  title: string;
  width: number;
  height: number;
  x?: number;                    // centered if omitted
  y?: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  frameless?: boolean;           // creation-only
  noActivate?: boolean;          // creation-only
  transparentTitlebar?: boolean; // creation-only
  route?: string;                // in-app path to navigate to at boot
  chrome?: boolean;              // main window: install default menu/context-menu/tray; false skips it
}

export const windows: Record<string, WindowPreset> = {
  main: { title: "Deskapp", width: 1280, height: 800, resizable: true, route: "/" },
};
```

```ts
// From any handler/controller/button click — opens its own independent window:
await win.openWindow({ title: "Settings", width: 420, height: 320, route: "/settings" });
```

Each window is independent: its close (×) closes only that window; the app exits when the last one closes. Set `chrome: false` on the `main` preset to start without the default app menu, context menu and tray.

> [!WARNING] Deno 2.9.6 close-button regression
> On Deno 2.9.6 (Windows, webview/CEF) the native close button (× / Alt+F4) is a regression and does nothing until the fix in denoland/deno#36718 ships — use Deno 2.9.5 or a newer build to verify. Everything else (SPA navigation, bindings, per-window independence) is unaffected.