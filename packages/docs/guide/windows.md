# Windows & Native APIs

Deskapp uses Electron's BrowserWindow. It wraps window creation behind `win` (from the facade), reads presets from `src/window/config.ts`, and adds native chrome plus dialogs.

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

Presets are declared in `src/window/config.ts` and opened at boot. Additional windows can be opened at runtime:

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
| `chrome.setupDesktopChrome(win)`     | One-call setup for main window (menu + context menu + tray) | Called automatically in `main.ts` if chrome enabled |
| `chrome.installAppMenu(win)`         | Install application menu (`app-menu.ts`)                    | Manual control                                      |
| `chrome.installContextMenu(win)`     | Install right-click context menu (`context-menu.ts`)        | Manual control                                      |
| `chrome.createAppTray()`             | Create app tray with default menu/icon (`tray.ts`)          | Returns tray instance or undefined                  |
| `chrome.createTray()`                | Create custom tray                                          | Returns tray instance                               |
| `chrome.createHeadlessTray()`        | Create tray for headless mode                               | Keeps app alive without window                      |
| `chrome.hideDock()`                  | Hide macOS dock icon (for tray-only apps)                   | macOS only                                          |
| `chrome.alertDialog(msg)`            | Show alert dialog (`dialogs.ts`)                            | Synchronous                                         |
| `chrome.confirmDialog(msg)`          | Show confirm dialog (OK/Cancel)                             | Returns boolean                                     |
| `chrome.promptDialog(msg, default?)` | Show prompt dialog                                          | Returns string or null if cancelled                 |
| `chrome.defaultMenuItems()`          | Get default menu items array                                | For customization                                   |
| `chrome.defaultContextMenuItems()`   | Get default context menu items                              | For customization                                   |

### Using from UI (via bindings)

Since `chrome` is backend-only, expose via controllers:

```ts
// src/modules/app/controllers/chrome.controller.ts
import { chrome, win } from "@/core/facade";

export const showAlert = async (msg: string) => { chrome.alertDialog(msg); return { ok: true }; };
export const showConfirm = async (msg: string) => { return { confirmed: chrome.confirmDialog(msg) }; };
export const showPrompt = async (msg: string, def?: string) => { return { value: chrome.promptDialog(msg, def) }; };
export const toggleTray = async () => { const tray = chrome.createAppTray(); return { ok: !!tray }; };

export const handlers = { showAlert, showConfirm, showPrompt, toggleTray };
```

```vue
<button @click="() => md.app.chrome.showAlert('Hello!')">Alert</button>
<button @click="async () => { const r = await md.app.chrome.showConfirm('Continue?'); console.log(r.confirmed); }">Confirm</button>
```

## File pickers (`window/dialogs.ts`)

Native file dialogs via Electron's `dialog` module:

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
