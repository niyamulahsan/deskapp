# Architecture

Deskapp is a **single-process** desktop app: the Electron main process hosts the backend, the SQLite database, and manages native windows. The UI runs in a Chromium renderer process with access to backend functionality via secure IPC bindings.

## Runtime topology

```
                    Electron (main process)
┌─────────────────────────────────────────────────────────────────────────────┐
│ src/main.ts                                                                 │
│  app.whenReady()    → boots app                                             │
│  loadEnv()          → loads .env                                            │
│  db.init()          → opens SQLite (libsql)                                 │
│  storage.init()     → creates private + tmp disks                           │
│  bindAll()          → registers controller handlers over IPC                │
│  for each windows preset: win.createWindow(preset) with preload             │
│   chrome.setupDesktopChrome(win) → app menu + tray on main win              │
│                                                                             │
│    bindings (IPC via preload)  │ loads renderer                             │
│                                ▼                                            │
│ Vue 3 renderer in the OS window                                             │
│  bindings['<module>.<controller>.handler']('...') → IPC → main handler      │
└─────────────────────────────────────────────────────────────────────────────┘
```

There is a process boundary between UI and backend enforced by Electron. The `bindings` object exposed in the renderer via preload script calls backend handlers through `ipcRenderer.invoke` which are handled by `ipcMain.handle`.

## File roles

| Path                                 | Role                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`                        | Electron main process entrypoint. Boots DB + storage, creates windows with preload, binds handlers. Never edit for new windows — use `src/window/config.ts`. |
| `src/preload.ts`                     | Preload script exposing `bindings` to renderer via contextBridge over IPC.                                                                                   |
| `src/window/config.ts`               | `windows` preset map (add a key = add a window).                                                                                                             |
| `src/window/manager.ts`              | `win` namespace (`createWindow` / `openWindow` / `getWindow` / `getWindowCount`), window lifecycle + close-to-quit logic.                                    |
| `src/window/native.ts`               | `chrome` namespace (tray, menus, dialogs, setup).                                                                                                            |
| `src/window/dialogs.ts`              | `pickers` namespace (`open` / `save` / `folder`).                                                                                                            |
| `src/core/facade.ts`                 | **The public API surface.** Everything app code imports it through — one import, no reaching into internals.                                                 |
| `src/core/api/registry.ts`           | Reads each controller's `handlers` map and binds every entry over IPC as `<module>.<controller>.<handler>`.                                                  |
| `src/core/api/bindings.generated.ts` | Generated discovery of controllers (via maker).                                                                                                              |
| `src/core/database/*`                | Connection, config, pagination, seed runner, migration hooks, reset, status.                                                                                 |
| `src/core/utils/*`                   | Queue, scheduler, storage, password, validation, playwright helpers.                                                                                         |
| `src/core/maker/*`                   | The `maker` CLI (scaffolders, database ops).                                                                                                                 |
| `scripts/build-electron.mjs`         | Builds main and preload with esbuild.                                                                                                                        |
| `src/modules/*`                      | Example/host modules. `app` ships demo controllers wired to the dashboard.                                                                                   |

## Headless mode

Headless mode runs without UI windows (tray-only).

**Activation conditions:**

- `DESKAPP_UI=false` in `.env` disables UI even if built

The decision logic in `src/main.ts`:

```ts
if (config.ui.enabled) {
  // create windows...
} else {
  // headless mode - create tray
  chrome.hideDock();
  chrome.createHeadlessTray();
}
```

When headless:
- No renderer windows are created
- A system tray keeps the process alive
- All backend services (DB, queue, cron) still run normally
- Bindings are still registered for potential IPC calls if needed

## Modules & bindings

Every module under `src/modules` may contain `controllers/`, `database/models/`, and `database/seeders/`.

- A controller exports `handlers` — each handler becomes accessible as `bindings['<module>.<controller>.<handler>']` from the renderer.
- Models are Drizzle tables aggregated into `src/database/schema.ts` by the maker CLI.
- Seeders are auto-ordered by foreign keys and run via the maker CLI.

See [Modules](./modules.md) and [Controllers & Bindings](./controllers.md).

## When window APIs are unavailable

`win.createWindow` may behave differently depending on context. Guard window work accordingly:

```ts
import { win } from "@/core/facade";

const w = win.createWindow({ title: "About" });
if (!w) return;
```
