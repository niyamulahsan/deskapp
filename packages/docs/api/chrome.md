# `chrome` — native desktop chrome

Imported from the facade: `import { chrome } from "@/core/facade.ts"`.

::: warning BACKEND-ONLY
`chrome` runs on the **Deno backend** — the webview (Vue UI) can never `import` it. To use these native features from the frontend, call the bindings that a controller exposes (see [From the webview](#from-the-webview-bindings) below). The flow is always **webview → binding → controller → facade → Deno Desktop**.
:::

Tray, application/context menus, and native dialog helpers that sit on top of Deno Desktop. See [Windows & Native APIs](../guide/windows).

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `createTray` | `() => DesktopTray \| undefined` | Create a low-level tray. Returns `undefined` when the runtime has no tray support. |
| `isTrayAvailable` | `() => boolean` | Whether a system tray can be created on this runtime/OS. |
| `confirmDialog` | `(message: string) => boolean` | Synchronous OS OK/Cancel dialog. |
| `alertDialog` | `(message: string) => void` | Synchronous OS message dialog. |
| `promptDialog` | `(message: string, defaultValue?: string) => string \| null` | Synchronous OS input dialog; `null` on cancel. |
| `defaultMenuItems` | `() => MenuItem[]` | Default application menu (File: New / Open Settings / quit role; Edit: undo/redo/cut/copy/paste) for `installAppMenu`. |
| `installAppMenu` | `(win: DesktopWindow) => void` | Install the default application menu onto a window. |
| `createAppTray` | `() => DesktopTray \| undefined` | Create the app tray with default icon + menu; clicking the icon shows and focuses the main window. |
| `defaultContextMenuItems` | `() => MenuItem[]` | Default right-click menu items. |
| `installContextMenu` | `(win: DesktopWindow) => void` | Wire right-click (and context-menu events) on a window. |
| `setupDesktopChrome` | `(win: DesktopWindow) => void` | One-shot setup: app menu + context menu + tray for the main window. |
| `createHeadlessTray` | `() => DesktopTray \| undefined` | Keep the app alive with a tray-only after the last window closes (headless mode). |
| `hideDock` | `() => void` | Hide the macOS dock icon (used in tray-only/headless mode). |

## Types

```ts
type MenuItem = MenuActionItem | MenuSubmenu | "separator" | { role: MenuRole };

interface MenuRole { role: string; }                       // OS-provided label + behavior
interface MenuActionItem { item: { label: string; id?: string; accelerator?: string; enabled?: boolean }; }
interface MenuSubmenu { submenu: { label: string; items: MenuItem[] }; }

interface DesktopTray {
  trayId: number;
  setIcon(pngBytes: Uint8Array): void;
  setIconDark(pngBytes: Uint8Array | null): void;
  setTooltip(text: string | null): void;
  setMenu(items: unknown[] | null): void;
  destroy(): void;
  addEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
}
```

## Use cases

### Startup: install menus + tray once (`src/main.ts`)

The one-shot setup for the main window — application menu, right-click menu, and system tray in a single call.

```ts
import { chrome, win } from "@/core/facade.ts";

chrome.setupDesktopChrome(win.getWindow()!);
```

### Guard destructive actions (backend) — `confirmDialog`

Ask before an irreversible operation. Synchronous and blocking — keep the message short.

```ts
if (chrome.confirmDialog(`Delete "${file.name}" permanently?`)) {
  await files.removePath(file.path);
} else {
  return { ok: false, cancelled: true };
}
```

### Prompt for a value (backend) — `promptDialog`

Name things at runtime (new document, export name). Returns `null` when the user cancels.

```ts
const name = chrome.promptDialog("Name for the export", `export-${Date.now()}`);
if (name) await files.writeTextFile(name.endsWith(".csv") ? name : `${name}.csv`, csv);
```

### Tray-driven app (minimize-to-tray, open window, quit)

The default app tray shows your window when clicked; wire your own menu with `createTray`.

```ts
const tray = chrome.createAppTray();       // icon + menu; click toggles the main window
tray?.setTooltip("MyApp");

// custom tray with your own items:
const custom = chrome.createTray();
custom?.setMenu([
  { item: { label: "Show window", id: "show", enabled: true } },
  { item: { label: "Settings", id: "settings", enabled: true } },
  "separator",
  { item: { label: "Quit", id: "quit", enabled: true } },
]);
custom.addEventListener("menuclick", (e) => {
  switch ((e.detail as { id?: string }).id) {
    case "show": win.getWindow()?.show(); break;
    case "settings": void win.openWindow("settings"); break;
    case "quit": Deno.exit(0); break;
  }
});
```

### Background / tray-only app (macOS — hide the dock)

For utilities that run from the tray without a visible dock icon. Pair with a hidden main window.

```ts
chrome.hideDock();                     // hide the macOS dock icon
const tray = chrome.createHeadlessTray(); // keep the process alive after windows close
```

### In-window right-click menus — `installContextMenu`

Attach a consistent context menu to any window (used by `setupDesktopChrome` internally too).

```ts
chrome.installContextMenu(win.getWindow()!);         // default items
```

## From the webview (bindings)

`chrome` itself is **backend/startup-only** — it's meant to be called from a controller, not from the UI. To reach it from the webview, bridge it through your own controller + binding:

```ts
// controller: <module>.chrome.*
import { chrome } from "@/core/facade.ts";

export const confirmSomething = (message: string) => chrome.confirmDialog(message);
export const alertSomething = (message: string) => { chrome.alertDialog(message); return true; };
export const createTray = () => !!chrome.createAppTray();

export const handlers = { confirmSomething, alertSomething, createTray };
```

```ts
// UI
const ok = await bindings["<module>.chrome.confirmSomething"]("Delete this file?");
await bindings["<module>.chrome.alertSomething"]("Hello");
```

Anything not bridged — `setupDesktopChrome`, `installAppMenu`, `installContextMenu`, `createAppTray`, `createHeadlessTray`, `hideDock` — is **startup/backend-only** (used in the backend entrypoint and other Deno controllers) and is never meant to be called from the UI.

## Notes

- Each `createTray()` constructs a **fresh** OS tray (you set icon/menu yourself via `setIcon`/`setMenu`); `createAppTray` labels it, sets an icon when `src/icons/tray.png` exists, and wires `click` (show window) + `menuclick` (its menu IDs) handlers. Tray events are `click` and `menuclick`.
- Native dialogs are **synchronous** (blocking) — use them for short confirmations, not long-running flows.
- Menus are expressed as a tagged union (`MenuActionItem` / `MenuSubmenu` / `"separator"` / role item) — see the `MenuItem` type above.

## Related

- [win](./win) · [pickers](./pickers)