# `chrome` — native desktop chrome

Imported from the facade: `import { chrome } from "@/core/facade.ts"`.

::: warning BACKEND-ONLY
`chrome` runs in the **Electron main process** — the renderer (Vue UI) can never `import` it. To use these native features from the frontend, call the bindings that a controller exposes (see [From the webview](#from-the-webview-bindings) below). The flow is always **webview → binding → controller → facade → Electron**.
:::

Tray, application/context menus, and native dialog helpers that sit on top of Electron's `Tray` / `Menu` / `dialog` modules. See [Windows & Native APIs](../guide/windows).

## Signature

| Function             | Signature                                                      | Description                                                                                                            |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `createTray`         | `() => Tray \| undefined`                                      | Create (or reuse) a low-level Electron `Tray`. Returns `undefined` when no icon could be loaded.                       |
| `isTrayAvailable`    | `() => boolean`                                                | Whether a system tray can be created on this runtime/OS.                                                               |
| `confirmDialog`      | `(message: string) => Promise<boolean>`                        | OS OK/Cancel dialog; resolves `true` when OK is chosen.                                                                |
| `alertDialog`        | `(message: string) => Promise<void>`                           | OS message dialog; resolves when dismissed.                                                                            |
| `defaultMenuItems`   | `() => MenuItem[]`                                             | Default application menu (File: New / Open Settings / quit role; Edit: undo/redo/cut/copy/paste) for `installAppMenu`. |
| `installAppMenu`     | `(win: DesktopWindow) => void`                                 | Install the default application menu onto a window.                                                                    |
| `createAppTray`      | `() => Tray \| undefined`                                      | Create the app tray with the default icon + menu (Show window / Open Settings / Quit).                                 |
| `installContextMenu` | `(win: DesktopWindow) => void`                                 | Wire the right-click (copy / paste / separator / reload) menu on a window.                                             |
| `setupDesktopChrome` | `(win: DesktopWindow, parts?: Required<ChromeParts>) => void`  | One-shot setup: app menu + context menu + tray for the main window (defaults to all enabled).                          |
| `createHeadlessTray` | `() => Tray \| undefined`                                      | Keep the app alive with a tray-only after the last window closes (headless mode).                                      |
| `hideDock`           | `() => void`                                                   | Hide the macOS dock icon (used in tray-only/headless mode).                                                            |
| `resolveChrome`      | `(chrome?: boolean \| ChromeParts) => Required<ChromeParts>`   | Normalize a preset's `chrome` flag into explicit `{ appMenu, contextMenu, tray }` flags.                               |

## Types

```ts
type MenuItem = MenuActionItem | MenuSubmenu | "separator" | { role: MenuRole };

interface MenuRole { role: string; }                       // OS-provided label + behavior
interface MenuActionItem { item: { label: string; id?: string; accelerator?: string; enabled?: boolean }; }
interface MenuSubmenu { submenu: { label: string; items: MenuItem[] }; }

interface ChromeParts { appMenu?: boolean; contextMenu?: boolean; tray?: boolean; }

// The tray is Electron's own Tray instance.
type DesktopTray = Electron.Tray;
```

## Use cases

### Startup: install menus + tray once (`src/main.ts`)

The one-shot setup for the main window — application menu, right-click menu, and system tray in a single call. `main.ts` reads the preset's `chrome` flag, normalizes it with `chrome.resolveChrome`, and applies it to the first window only:

```ts
import { chrome, win } from "@/core/facade.ts";

const main = win.getWindow();
if (main) chrome.setupDesktopChrome(main); // defaults to app menu + context menu + tray
```

### Guard destructive actions (backend) — `confirmDialog`

Ask before an irreversible operation. It is **async** (Electron's `dialog.showMessageBox`) — `await` it.

```ts
import { chrome, files } from "@/core/facade.ts";

if (await chrome.confirmDialog(`Delete "${file.name}" permanently?`)) {
  await files.removePath(file.path);
} else {
  return { ok: false, cancelled: true };
}
```

### Tray-driven app (minimize-to-tray, open window, quit)

The default app tray shows your window when its menu item is clicked; build your own with `createTray` + a context menu.

```ts
import { app, Menu } from "electron";
import { chrome, win } from "@/core/facade.ts";

const tray = chrome.createAppTray(); // icon + Show window / Open Settings / Quit menu

// custom tray with your own items:
const custom = chrome.createTray();
custom?.setContextMenu(Menu.buildFromTemplate([
  { label: "Show window", click: () => win.getWindow()?.show() },
  { label: "Settings", click: () => void win.openWindow("settings") },
  { type: "separator" },
  { label: "Quit", click: () => app.quit() },
]));
```

### Background / tray-only app (macOS — hide the dock)

For utilities that run from the tray without a visible dock icon. Pair with a hidden main window.

```ts
chrome.hideDock();                        // hide the macOS dock icon
const tray = chrome.createHeadlessTray(); // keep the process alive after windows close
```

### In-window right-click menus — `installContextMenu`

Attach a consistent context menu to any window (used by `setupDesktopChrome` internally too).

```ts
chrome.installContextMenu(win.getWindow()!);
```

## From the webview (bindings)

`chrome` itself is **backend/startup-only** — it's meant to be called from a controller, not from the UI. To reach it from the webview, bridge it through your own controller + binding:

```ts
// controller: <module>.chrome.*
import { chrome } from "@/core/facade.ts";

export const confirmSomething = (message: string) => chrome.confirmDialog(message);
export const alertSomething = async (message: string) => { await chrome.alertDialog(message); return true; };
export const createTray = () => !!chrome.createAppTray();

export const handlers = { confirmSomething, alertSomething, createTray };
```

```ts
// UI
const ok = await bindings["<module>.chrome.confirmSomething"]("Delete this file?");
await bindings["<module>.chrome.alertSomething"]("Hello");
```

Anything not bridged — `setupDesktopChrome`, `installAppMenu`, `installContextMenu`, `createAppTray`, `createHeadlessTray`, `hideDock` — is **startup/backend-only** and is never meant to be called from the UI.

## Notes

- `createTray()` returns a **cached** Electron `Tray` (created once, reused on later calls) and tries `src/icons/tray.png`, `favicon-96x96.png`, `favicon.ico`, the web-app-manifest PNGs, then the executable icon, with a tiny built-in fallback so a tray still appears.
- Native dialogs are **asynchronous** (they return a `Promise`) — `await` them.
- `alertDialog` and `confirmDialog` are also exported at the **top level** of the facade (same functions as `chrome.alertDialog` / `chrome.confirmDialog`).
- Menus are expressed as a tagged union (`MenuActionItem` / `MenuSubmenu` / `"separator"` / role item) — see the `MenuItem` type above.

## Related

- [win](./win) · [pickers](./pickers)
