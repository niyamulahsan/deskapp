# Windows & Native APIs

Deskapp uses Electron's BrowserWindow. It wraps window creation behind `win` (from the facade), reads presets from `src/config/winsetup.ts`, and adds native chrome plus dialogs.

## Window manager

Available from the facade:

| Function                                      | Description                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `win.createWindow(preset, name, preloadPath)` | Create a window from a preset. Used internally by `main.ts`.                        |
| `win.openWindow(preset)`                      | Open a window on demand — accepts a config preset name or an inline `WindowPreset`. |
| `win.getWindow(id?)`                          | Look up a window by id; no arg returns the first/main window.                       |
| `win.getWindowCount()`                        | Number of tracked open windows.                                                     |

Windows are independent. Closing a window closes only that window. On non-macOS platforms, the app quits when all windows are closed (configured in `main.ts`).

## Window presets & on-demand windows

Presets are declared in `src/config/winsetup.ts` and opened at boot. Additional windows can be opened at runtime:

```ts
import { win } from "@/core/facade";

// Open a window
await win.openWindow({ title: "Settings", width: 420, height: 320, route: "/settings" });
```

`win.openWindow` accepts a preset name from the config map or a `WindowPreset` object. It navigates to the route if specified.

## Native chrome, menus, tray & dialogs

Modules are split across `src/window/`: `native.ts` (facade exports), `app-menu.ts` (application menu), `context-menu.ts` (right-click menu), `tray.ts` (system tray), `dialogs.ts` (native dialogs). All exposed through the facade as `chrome`.

### Configuration

In `src/config/winsetup.ts`, configure windows and chrome:

```ts
export const windows: Record<string, WindowPreset> = {
  main: {
    title: config.appName,
    width: 900,
    height: 600,
    resizable: true,
    route: "/",
    chrome: true, // set to false to disable default menu, context menu, tray
  }
};
```

- `chrome: true` (default) - installs default app menu, context menu, and tray on the main window
- `chrome: false` - disables default desktop chrome

### Available APIs (`chrome` from facade)

| Method                               | Purpose                                                     | Usage                                               |
| ------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------- |
| `chrome.setupDesktopChrome(win, parts?)` | One-call setup for main window (menu + context menu + tray) | Called automatically in `main.ts` if chrome enabled |
| `chrome.installAppMenu(win)`         | Install application menu (`app-menu.ts`)                    | Manual control                                      |
| `chrome.installContextMenu(win)`     | Install right-click context menu (`context-menu.ts`)        | Manual control                                      |
| `chrome.createAppTray()`             | Create app tray with default menu/icon (`tray.ts`)          | Returns tray instance or undefined                  |
| `chrome.createTray()`                | Create custom tray                                          | Returns tray instance or undefined                  |
| `chrome.createHeadlessTray()`        | Create tray for headless mode                               | Keeps app alive without window                      |
| `chrome.hideDock()`                  | Hide macOS dock icon (for tray-only apps)                   | macOS only                                          |
| `chrome.alertDialog(msg)`            | Show alert dialog (`dialogs.ts`)                            | **Async** — `await` it                              |
| `chrome.confirmDialog(msg)`          | Show confirm dialog (OK/Cancel)                             | **Async** — resolves `boolean`                      |
| `chrome.defaultMenuItems()`          | Get default menu items array                                | For customization                                   |
| `chrome.resolveChrome(flag?)`        | Normalize a preset's `chrome` flag to `ChromeParts`         | `{ appMenu, contextMenu, tray }`                    |

### Modifying menus & tray

Default desktop chrome is installed from `main.ts` through `chrome.setupDesktopChrome(win, parts?)`, but it is ordinary app code — edit these three files directly to change it:

| File                         | Controls                | Key exports                                                                                  |
| ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `src/window/app-menu.ts`     | Application menu bar    | `defaultMenuItems()`, `toElectronMenu(items)`, `installAppMenu(win)`, `removeAppMenu(win)`   |
| `src/window/context-menu.ts` | Right-click menu        | `installContextMenu(win)`, `disableContextMenu(win)`                                         |
| `src/window/tray.ts`         | System tray icon + menu | `createTray()`, `createAppTray()`, `createHeadlessTray()`, `hideDock()`, `isTrayAvailable()` |

`defaultMenuItems()` returns a small typed template. Edit it — or call `installAppMenu` with your own `toElectronMenu(...)` template — to add or remove items:

```ts
// src/window/app-menu.ts
export function defaultMenuItems(): MenuItem[] {
  return [
    {
      submenu: {
        label: "File",
        items: [
          { item: { label: "New", id: "new", accelerator: "CmdOrCtrl+N", enabled: true } },
          "separator",
          { role: { role: "quit" } }
        ]
      }
    }
  ];
}
```

Each `MenuItem` is one of:

- `{ item: { label, id?, accelerator?, enabled? } }` — a clickable item. Its `id` is forwarded to the renderer as `webContents.send("menu-click", id)`, so a page listens with `ipcRenderer.on("menu-click", …)`.
- `{ submenu: { label, items } }` — a nested submenu.
- `"separator"` — a divider.
- `{ role: { role: "undo" } }` — a built-in Electron role (`copy`, `paste`, `quit`, …).

The context menu builds its template inline in `installContextMenu` (`context-menu.ts`), and the tray builds its right-click menu inline in `createAppTray` (`tray.ts`) — edit those templates to change the entries, and swap the icon via `createTray()`.

> Menu, context menu and tray apply to the **main window only**. Set `chrome: false` in `src/config/winsetup.ts` to skip them entirely, or pass `parts` to `setupDesktopChrome` to disable just one (`{ appMenu, contextMenu, tray }`).

### Using from UI (via bindings)

Since `chrome` is backend-only, expose via controllers. Native dialogs are **async**, so `await` them:

```ts
// src/modules/app/controllers/chrome.controller.ts
import { chrome, win } from "@/core/facade";

export const showAlert = async (msg: string) => { await chrome.alertDialog(msg); return { ok: true }; };
export const showConfirm = async (msg: string) => ({ confirmed: await chrome.confirmDialog(msg) });
export const toggleTray = async () => { const tray = chrome.createAppTray(); return { ok: !!tray }; };

export const handlers = { showAlert, showConfirm, toggleTray };
```

```vue
<button @click="() => md.app.chrome.showAlert('Hello!')">Alert</button>
<button @click="async () => { const r = await md.app.chrome.showConfirm('Continue?'); console.log(r.confirmed); }">Confirm</button>
```

## File pickers

Native file dialogs via Electron's `dialog` module (`src/window/dialogs.ts`):

| Function                  | Description        |
| ------------------------- | ------------------ |
| `pickers.open(options)`   | Open file dialog   |
| `pickers.save(options)`   | Save file dialog   |
| `pickers.folder(options)` | Open folder dialog |

```ts
import { pickers } from "@/core/facade";

const src = await pickers.open({ title: "Choose a file" });
const dest = await pickers.save({ title: "Save as", defaultName: "export.csv" });
const dir = await pickers.folder({ title: "Pick a folder" });
```

Options vary by OS; the API provides a consistent interface.
