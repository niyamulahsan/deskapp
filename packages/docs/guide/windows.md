# Windows & Native APIs

Deskapp uses Electron's BrowserWindow. It wraps window creation behind `win` (from the facade), reads presets from `src/window/config.ts`, and adds native chrome plus dialogs.

## Window manager

Available from the facade:

| Function | Description |
| --- | --- |
| `win.createWindow(preset, name, preloadPath)` | Create a window from a preset. Used internally by `main.ts`. |
| `win.openWindow(preset)` | Open a window on demand — accepts a config preset name or an inline `WindowPreset`. |
| `win.getWindow(id?)` | Look up a window by id; no arg returns the first/main window. |
| `win.getWindowCount()` | Number of tracked open windows. |

Windows are independent. Closing a window closes only that window. On non-macOS platforms, the app quits when all windows are closed (configured in `main.ts`).

## Window presets & on-demand windows

Presets are declared in `src/window/config.ts` and opened at boot. Additional windows can be opened at runtime:

```ts
import { win } from "@/core/facade";

// Open a window
await win.openWindow({ title: "Settings", width: 420, height: 320, route: "/settings" });
```

`win.openWindow` accepts a preset name from the config map or a `WindowPreset` object. It navigates to the route if specified.

## Native chrome (`window/native.ts`)

Exposed through the facade (`chrome`):

- `chrome.setupDesktopChrome(win)` - Installs default app menu, context menu, and tray on a window.
- `chrome.installAppMenu(win)` / context menu helpers
- `chrome.createAppTray()` / `chrome.createTray()` - System tray
- `chrome.confirmDialog` / `chrome.alertDialog` / `chrome.promptDialog` - Native dialogs
- `chrome.hideDock()` / `chrome.createHeadlessTray()` - macOS dock hiding and tray-only mode

The main window gets desktop chrome automatically in `src/main.ts`. Set `chrome: false` in the preset to opt out.

## File pickers (`window/dialogs.ts`)

Native file dialogs via Electron's `dialog` module:

| Function | Description |
| --- | --- |
| `pickers.open(options)` | Open file dialog |
| `pickers.save(options)` | Save file dialog |
| `pickers.folder(options)` | Open folder dialog |

```ts
import { pickers } from "@/core/facade";

const src = await pickers.open({ title: "Choose a file" });
const dest = await pickers.save({ title: "Save as", defaultName: "export.csv" });
const dir = await pickers.folder({ title: "Pick a folder" });
```

Options vary by OS; the API provides a consistent interface.
