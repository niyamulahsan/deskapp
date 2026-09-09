# Windows & Native APIs

Deno Desktop provides `Deno.BrowserWindow`. Deskapp wraps it behind `DesktopWindow` (structural — it only exists under `deno desktop`), reads presets from `src/window/config.ts`, and adds native chrome plus dialogs on top.

## Window manager

Available from the facade:

| Function | Description |
| --- | --- |
| `win.createWindow(options?)` | Create (or on first call, *adopt*) a window. Returns `DesktopWindow` or `undefined` outside `deno desktop`. |
| `win.openWindow(preset)` | Open a window on demand — a config preset name or an inline `WindowPreset`; binds handlers and navigates to its route. |
| `win.getWindow(id?)` | Look up a window by `windowId`; no arg = the main (first) window. |
| `win.getWindowCount()` | Number of tracked open windows. |
| `win.watchFrontend(distPath, onChange)` | **Dev only** — polls a directory (e.g. `src/ui/dist`) and calls `onChange` on rebuild. `deno task dev` uses it to reload the open window after UI edits. |

`win.createWindow` tracks windows by `windowId`. Windows are **independent**: clicking the close (×) button on any window closes only that window — the others keep running. The app quits when the **last** window is closed (this is Deno Desktop's documented lifecycle: closing a window does not stop the runtime; the process keeps running until all windows are closed). Reopening from the tray/menu works again because closed named windows are dropped from tracking in `src/window/manager.ts`.

The lifecycle, at a glance:

| Scenario | Main window | Settings window | App quits? |
| --- | --- | --- | --- |
| Close main | closed | stays open | no |
| Close settings | stays open | closed | no |
| Close last remaining window | — | — | **yes** |

### DesktopWindow surface

```ts
interface DesktopWindow {
  windowId: number;
  bind(name: string, handler: (...args: unknown[]) => unknown): void;

  // events (EventTarget)
  addEventListener(type, listener);
  removeEventListener(type, listener);

  show(): void; hide(): void; focus(): void; close(): void;
  reload(): void; isClosed(): boolean; isVisible(): boolean;

  getSize(): [number, number]; setSize(w, h): void;
  getPosition(): [number, number]; setPosition(x, y): void;
  isResizable(): boolean; setResizable(b): void;
  isAlwaysOnTop(): boolean; setAlwaysOnTop(b): void;
  setTitle(title: string): void;
  navigate(url: string): void;

  setApplicationMenu(items): void;
  showContextMenu(x, y, items): void;
  executeJs(code: string): Promise<unknown>;
  openDevtools(opts?): void;
}
```

### Window presets & on-demand windows

Only presets declared in `src/window/config.ts` open at **boot** — by default just `main`. Additional windows are opened at runtime through the reusable `win.openWindow()` API, with an inline preset:

```ts
import { win } from "@/core/facade.ts";

// On a button click / menu item / controller handler:
await win.openWindow({ title: "Help", width: 760, height: 600, route: "/help" });
```

`win.openWindow` accepts a preset name from the config map or a `WindowPreset` object. It bind handlers, navigates to the route, and reuses an already-open window (same title) instead of duplicating it. Every window is independent — its own close (×) closes only that window.

To open an arbitrary **external site** in a second window from the frontend, expose a small handler from your own controller + binding:

```ts
// controller: <module>.window.openUrl
import { win } from "@/core/facade.ts";

export const openUrl = async (url: string) => {
  if (!/^https?:\/\//.test(url)) return false;   // only http/https accepted
  const w = await win.openWindow({ title: new URL(url).hostname, width: 1024, height: 720 });
  if (w) w.navigate(url);
  return !!w;
};

export const handlers = { openUrl };
```

```ts
// From a button click / input handler in the UI:
const ok = await bindings["<module>.window.openUrl"]("https://vite.dev");
```

The window is keyed by hostname, so reopening the same site focuses the existing window.

## Native chrome (`window/native.ts`)

Exposed through the facade:

- `chrome.setupDesktopChrome(win)` — installs the default app menu + tray on the main window at startup.

The main window gets desktop chrome **automatically** (`src/main.ts` calls `setupDesktopChrome` for it at boot). To opt out, set `chrome: false` on the main preset in `src/window/config.ts` — or skip the automatic path entirely and attach only the pieces you want later (`chrome.setupDesktopChrome` is just `installAppMenu` + `installContextMenu` + `createAppTray`). Windows opened later with `win.openWindow()` never get desktop chrome automatically; call the chrome helpers yourself when you need them.
- `chrome.installAppMenu(win)` / `chrome.defaultMenuItems` — application menu with `MenuItem`, `MenuRole`, etc.
- `chrome.installContextMenu(win)` / `chrome.defaultContextMenuItems` — right-click menu.
- `chrome.createTray()` / `chrome.createAppTray()` / `chrome.isTrayAvailable()` — system tray (used in headless mode too).
- `chrome.confirmDialog` / `chrome.alertDialog` / `chrome.promptDialog` — native message dialogs.
- `chrome.hideDock()` / `chrome.createHeadlessTray()` — macOS dock hiding + tray-only mode.

## File pickers (`window/dialogs.ts`)

Deno Desktop doesn't expose native pickers yet, so each OS gets its genuine dialog behind one API:

| Function | Backend |
| --- | --- |
| `pickers.open(options)` | Windows: WinForms `OpenFileDialog` via a hidden `wscript`→PowerShell chain (no console flash). macOS: AppKit `NSOpenPanel` via osascript/JXA. Linux: `zenity`, falling back to `kdialog`. |
| `pickers.save(options)` | same, with `SaveFileDialog` / `NSSavePanel` / `--save` |
| `pickers.folder(options)` | `FolderBrowserDialog` / `NSOpenPanel(dirs)` / `--directory` |

All return the chosen absolute path as a string, or `null` when the user cancels or the dialog fails.

```ts
import { pickers } from "@/core/facade.ts";

const src = await pickers.open({ title: "Choose a file" });
const dest = await pickers.save({ title: "Save as", defaultName: "export.csv" });
const dir = await pickers.folder({ title: "Pick a folder" });
```

Options:

- `PickOpenOptions`: `{ title?, filter? }`
- `PickSaveOptions`: `{ title?, defaultName?, filter? }`
- `PickFolderOptions`: `{ title? }`

`filter` uses the WinForms syntax, e.g. `"Text files (*.txt)|*.txt|All files (*.*)|*.*"` (ignored on macOS/Linux where the OS has its own filters).

## Known quirks

> [!IMPORTANT] Windows Smart App Control can block child processes
> On Windows 11, **Smart App Control (SAC)** may silently block the app from spawning helper processes — a Playwright browser download/launch, file dialogs, or the tray. Symptom: an error like `Failed to spawn '...': Invalid handle`. The workaround: turn SAC **off** (Windows Security → App & browser control → Smart App Control → `Off`), run/retry, then switch it back **on** when done. Other OSes have no equivalent gate — this is Windows-specific, so no such step is needed on macOS or Linux.

> [!WARNING] Version-specific Deno Desktop regressions
> The default setup — one `main` window running the SPA at `route: "/"` with in-process bindings — is unaffected. The items below only bite in the exact combination listed (OS + Deno version + secondary windows):

- **Deno 2.9.6 on Windows/CEF/webview: the native close button (× / Alt+F4) does nothing** (denoland/deno#36715) — a regression in that release only. Workaround: use Deno 2.9.5 or a build after denoland/deno#36718 (already merged into `main`).
- The **first** `new Deno.BrowserWindow()` adopts the implicit startup window; position/size on the very first window may be ignored on some platforms.
- **macOS secondary-window close**: in some Deno Desktop versions (e.g. 2.9.2) the `close` event fires globally, so closing a subwindow can also trigger close handlers of other windows (denoland/deno#35981). The window manager keys every handler on its own `windowId` and only quits when tracked windows reach zero, so overlapping events are filtered.
- **macOS secondary-window `close()`/`hide()`** may hang in affected versions (denoland/deno#35568); prefer letting the OS close button fire the `close` event rather than calling `win.close()` programmatically.
- `executeJs` is unreliable in some Deno Desktop versions — prefer bindings for UI→backend calls and `navigate`/`setTitle` for backend→UI effects.
- Headless mode hides the implicit window and parks it at `(-32000, -32000)` on Windows so it never surfaces.