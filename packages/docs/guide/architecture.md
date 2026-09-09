# Architecture

Deskapp is a **single-process** desktop app: one Deno runtime hosts the backend, the SQLite database, and serves the UI, while the UI runs in a native OS window (webview).

## Runtime topology

```
                     one Deno process (deno desktop)
┌──────────────────────────────────────────────────────────────────┐
│  src/main.ts                                                      │
│   Deno.serve(handler)      → serves src/ui/dist via @std/http     │
│   db.init()             → opens SQLite (node:sqlite / libsql)  │
│   storage.init()         → creates private + tmp disks          │
│   for each presets in windows: win.createWindow(preset)         │
│     bindAll(window)     → registers every controller handler   │
│     chrome.setupDesktopChrome(win)→ app menu + tray on main win │
│                                    │
│        bindings (in-process, no IPC) │  window.navigate(http://127.0.0.1:PORT/route)
│                                    ▼                             │
│  Vue 3 webview in the OS window                                    │
│   bindings['<module>.<controller>.handler']('...') → backend handler → native call │
└──────────────────────────────────────────────────────────────────┘
```

There is no network boundary between UI and backend. The `bindings` object in the webview is a `Proxy`: every access resolves to a backend handler by name and returns a Promise.

## File roles

| Path | Role |
| --- | --- |
| `src/main.ts` | Backend entrypoint. Serves the UI, boots DB + storage, creates windows, binds handlers. Never edit for new windows — use `src/window/config.ts`. |
| `src/window/config.ts` | `windows` preset map (add a key = add a window). |
| `src/window/manager.ts` | `win` namespace (`createWindow` / `openWindow` / `getWindow` / `getWindowCount` / `watchFrontend`), window lifecycle + close-to-quit logic. |
| `src/window/native.ts` | `chrome` namespace (tray, menus, dialogs, setup). |
| `src/window/dialogs.ts` | `pickers` namespace (`open` / `save` / `folder`). |
| `src/core/facade.ts` | **The public API surface.** Everything app code imports it through — one import, no reaching into internals. |
| `src/core/api/registry.ts` | Reads each controller's `handlers` map and binds every entry as `<module>.<controller>.<handler>`. |
| `src/core/api/generate.manifest.ts` | Generates `src/core/api/bindings.generated.ts` (the discovery fast-path, `deno task maker bindings:gen`). |
| `src/core/database/*` | Connection, config, pagination, seed runner, migration hooks, reset, status. |
| `src/core/utils/*` | Queue, scheduler, storage, password, validation, playwright helpers. |
| `src/core/maker/*` | The `maker` CLI (scaffolders, database ops, and the dev/build/bundle runner). |
| `src/core/bundle.ts` | Cross-platform build/bundle script (UI → desktop app → optional Chromium → zip). |
| `src/modules/*` | Example/host modules. `app` ships demo controllers (storage, network, windows, playwright, queue/cron) wired to the dashboard. |

## Headless mode

Headless mode activates when the UI is not available — either because it was disabled or because it hasn't been built yet.

**Activation conditions:**

- `DESKAPP_UI=false` in `.env` — disables UI even if the build exists
- `src/ui/dist/` missing — headless automatically (before the first `deno task maker build`)

The decision logic in `src/main.ts`:

```ts
const uiEnabled = config.ui.enabled && DIST_PATH !== undefined;
```

Both must be true for windows to open. When headless:

- The HTTP server returns a small JSON status (`{ app, ui: false, status: "ok" }`)
- The implicit startup window is hidden and parked off-screen
- A system tray keeps the process alive
- No bindings are registered (the UI isn't there to call them)

## Modules & bindings

Every module under `src/modules` may contain `controllers/`, `database/models/`, and `database/seeders/`.

- A controller exports `handlers` — each handler becomes `bindings['<module>.<controller>.<handler>']`.
- Models are Drizzle tables aggregated into `src/database/schema.ts` by `deno task maker db:schema`.
- Seeders are auto-ordered by foreign keys and run by `deno task maker db:seed`.

See [Modules](./modules.md) and [Controllers & Bindings](./controllers.md).

## When window APIs are unavailable

`win.createWindow` returns `undefined` when `Deno.BrowserWindow` isn't present (plain `deno serve`). Guard window work accordingly:

```ts
import { win } from "@/core/facade.ts";

const w = win.createWindow({ title: "About" });
if (!w) return; // not running under deno desktop
```