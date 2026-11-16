# `win` — window lifecycle

Imported from the facade: `import { win } from "@/core/facade.ts"`.

Creates, looks up, and counts Electron `BrowserWindow`s. Presets live in `src/config/winsetup.ts` (re-exported by `src/window/config.ts`). See [Windows & Native APIs](../guide/windows).

## The three types — how they relate

Before using the functions, understand the three names you'll meet. There is one **input shape**, one **output shape**, and one **input-or-output** shape:

| Type                   | What it is                                                                                                                                               | Where it appears                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `WindowPreset`         | The **preset**: `title`, `width`, `height` (all required) plus optional position/flags, a `route`, and a `chrome` flag.                                     | Passed to `openWindow`, and stored in `src/config/winsetup.ts`. |
| `BrowserWindowOptions` | An alias of `WindowPreset` — the build options you hand to `createWindow`.                                                                               | Passed to `createWindow`.                                     |
| `DesktopWindow`        | The **actual open window** you get back — it is Electron's `BrowserWindow`, so you call Electron methods on it (`setTitle`, `focus`, `loadURL`, ...).     | Returned by `createWindow`, `openWindow`, `getWindow`.        |

Reading a signature: **everything inside the parenthesis is what you hand in; the type after `=>` is the window you receive.**

```
win.createWindow(options?, name?, preloadPath?)  =>  DesktopWindow | undefined
                  └──── you pass options ────┘         └── you get a window ──┘
win.openWindow(presetOrName)                     =>  Promise<DesktopWindow | undefined>
```

## Signature

| Function         | Signature                                                               | Returns                               |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `createWindow`   | `(options?: BrowserWindowOptions, name?: string, preloadPath?: string)`  | `DesktopWindow \| undefined`          |
| `getWindow`      | `(id?: number)`                                                         | `DesktopWindow \| undefined`          |
| `getWindowCount` | `()`                                                                    | `number`                              |
| `openWindow`     | `(presetOrName: string \| WindowPreset)`                                | `Promise<DesktopWindow \| undefined>` |
| `watchFrontend`  | `(distPath: string, onChange: () => void)`                              | `void` (a no-op in Electron — see below) |

**Inputs:**

- `options` (`BrowserWindowOptions`): the preset — required `title`, `width`, `height`, plus optional `x`/`y` and flags (`resizable`, `alwaysOnTop`, `frameless`, `noActivate`, `transparentTitlebar`). All flags default to `false` (except `resizable`, which defaults to `true`).
- `name` (`string`): a label used to track the window by name (so reopening the same name focuses it instead of duplicating). Optional. Only meaningful for `createWindow`.
- `preloadPath` (`string`): the preload script for the window's `webPreferences`. Optional — `main.ts` passes `out/preload/index.cjs`, and the first resolved preload becomes the default for later windows.
- `presetOrName` (`string | WindowPreset`): either a **preset name** declared in `src/config/winsetup.ts` (e.g. `"settings"`), or an inline `WindowPreset` object.
- `id` (`number`): the numeric Electron window id (`BrowserWindow.id`). **No argument returns the main window.**
- `distPath` / `onChange` (`watchFrontend`): kept for API compatibility; the Electron implementation is a **no-op** because Vite's HMR already refreshes the renderer in dev.

**Outputs:**

- `DesktopWindow` — an Electron `BrowserWindow`. This is the object you keep and call methods on.
- `Promise<DesktopWindow | undefined>` — `openWindow` is async; always `await` it.
- `undefined` — returned when the requested preset name doesn't exist or the window isn't tracked.

> [!NOTE] Same window, same methods
> `getWindow()`, `createWindow()` and `await openWindow()` all hand you the **same `DesktopWindow` type** (an Electron `BrowserWindow`). Whatever methods you can call on the result of `getWindow()` (`setTitle`, `focus`, `loadURL`, `webContents`, `isDestroyed`, ...) you can call on the result of `openWindow()` too. The only difference is plumbing: `openWindow` is async and does extra work (resolves the preset, reuses an existing window, loads the route) before resolving.

## `createWindow` vs `openWindow` — the key difference

> [!IMPORTANT] You rarely call `createWindow` yourself
> `createWindow` is **already used internally** — the backend entrypoint (`src/main.ts`) calls it at boot for every window declared in `src/config/winsetup.ts`, so your **main window is created for you automatically**. In app code you almost always want the other functions:
>
> - **`openWindow`** — open an additional window on demand (settings, about, reports). This is the one to reach for.
> - **`getWindow()`** — grab the existing main window (with no argument) so you can drive it: `win.getWindow()?.setTitle(...)`.
> - **`getWindowCount()`** — how many windows are open.
>
> Only reach for `createWindow` when you need a raw, hand-managed bare window (e.g. an off-app window you'll `loadURL` to an external URL) and `openWindow`'s preset/routing convenience doesn't fit.

|                  | `createWindow`                                                                     | `openWindow`                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **What it does** | Opens a bare Electron window from raw options.                                      | Opens the preset and **loads its `route`** (dev) / the SPA shell (packaged).            |
| **Input**        | `BrowserWindowOptions` (no name-based reuse unless you pass one)                    | Preset name **or** `WindowPreset`                                                        |
| **Reuse**        | Always opens a new window.                                                          | Reopening the same preset name (or same inline `title`) focuses the already-open window. |
| **When to use**  | A plain/off-app window you'll drive manually — e.g. load an external site with `loadURL`. | A normal **in-app** window with a router route — settings, about, reports.         |

> Rule of thumb: use `openWindow` for anything that loads an app page; use `createWindow` only for a bare window you manage by hand — and remember the framework already used `createWindow` for the main window at startup.

## Types

```ts
interface WindowPreset {
  title: string;                 // required
  width: number;                 // required
  height: number;                // required
  x?: number; y?: number;        // centered when omitted
  resizable?: boolean;           // default true
  alwaysOnTop?: boolean;         // default false
  frameless?: boolean;           // creation-only
  noActivate?: boolean;          // creation-only
  transparentTitlebar?: boolean; // creation-only
  route?: string;                // in-app route to load on startup (e.g. "/settings")
  chrome?: boolean | ChromeParts; // desktop chrome for the FIRST (main) window only
}

interface ChromeParts { appMenu?: boolean; contextMenu?: boolean; tray?: boolean; }

// createWindow accepts the same shape.
type BrowserWindowOptions = WindowPreset;

// The open window IS Electron's BrowserWindow — full Electron API surface.
type DesktopWindow = Electron.BrowserWindow;
```

Because `DesktopWindow` is Electron's `BrowserWindow`, common methods include `setTitle`, `show`, `hide`, `focus`, `close`, `reload`, `isDestroyed`, `isVisible`, `getSize`, `setSize`, `getPosition`, `setPosition`, `setResizable`, `setAlwaysOnTop`, `loadURL`, `loadFile`, `setMenu`, and the `webContents` API (`executeJavaScript`, `openDevTools`, `send`, ...). See the [Electron BrowserWindow docs](https://www.electronjs.org/docs/latest/api/browser-window).

## Use cases

### Open a config-preset window (settings / about / reports)

Use `openWindow` with a name declared in `src/config/winsetup.ts` — reopening it focuses the already-open window instead of duplicating.

```ts
import { win } from "@/core/facade.ts";

// from a menu click, tray item, or controller handler:
await win.openWindow("settings");
await win.openWindow("about");
```

Here `"settings"` is a key in the `windows` map in `src/config/winsetup.ts`.

### Open a one-off window on demand (help / preview / detail)

Pass an inline `WindowPreset`; the window loads its `route` (dev) and is tracked by `title`.

```ts
async function previewItem(item: Item) {
  const w = await win.openWindow({ title: item.name, width: 900, height: 640, route: "/preview" });
  if (w) w.focus();
}
```

`w` is the returned `DesktopWindow`. The object passed in is the `WindowPreset`.

### Open an external website in its own window

`openWindow` gives you the instance, then `loadURL` jumps it to any URL — good for docs/support links.

```ts
const w = await win.openWindow({ title: "vite.dev", width: 1024, height: 720 });
if (w) w.loadURL("https://vite.dev");
```

### Drive the main window (title, focus, size) from anywhere

`getWindow()` with no argument returns the main (first-created) window — use it to reflect backend state in the UI.

```ts
const main = win.getWindow();
if (main) {
  main.setTitle(`${unsavedCount} unsaved changes`);
  main.focus();
}
```

### Multi-window state — how many windows are open?

`openWindow` reuses an already-open preset instead of duplicating it, so a count guard is rarely needed — but `getWindowCount()` is still useful to know whether any window survived a close.

```ts
console.log(win.getWindowCount()); // number of tracked windows (0 before the first is created)
```

### Feature-detect window work (safe in tests / CLI)

At boot the framework already created the main window, so the simplest check that has **no side effects** is `getWindow()`:

```ts
const main = win.getWindow();
if (!main) {
  console.log("no main window — skipping window setup");
}
```

> `getWindow()` / `getWindowCount()` only read the manager's in-memory map, so they are safe anywhere (they return `undefined` / `0` before a window exists). Creating a window, by contrast, needs the real Electron runtime — guard it when code also runs under Vitest or a plain Node CLI.

## Notes

- The app quits when the **last** tracked window closes (`shutdownApp` → `db.close()` then `app.quit()`); each window's close (×) button closes just that window.
- Reopening the same preset name (or same inline `title`) shows the open window instead of creating a duplicate.
- `openWindow` shows the window on its `ready-to-show` event to avoid a blank flash.

> [!TIP] `watchFrontend` is a compatibility no-op
> In the Electron build, Vite's HMR already reloads the renderer during `npm run dev`, so `win.watchFrontend()` does nothing. The function is kept so existing callers compile.

## Known behaviours with multiple windows

These come from the framework's window manager and are worth knowing before you build a multi-window UI.

- **All windows share one process.** There is no per-window backend. State lives in the shared Electron main process, so any window can read/write the same backend state — keep that in mind if you want per-window isolation.

- **The process exits when the last window closes.** Closing an extra window (that isn't the main) keeps the app running as long as at least one window remains open.

- **The main window is the first-created window.** `getWindow()` (no argument) returns `mainWindowId`'s window. When the main window closes, the slot is **reassigned to another open window** if one remains, and the app quits when none do.

- **Tray and app-menu actions act on the main window only.** `win.getWindow()` is what tray clicks, "Show window", and the tray's "Open Settings" item target. If you reorder windows so a different one is visually "front", these shortcuts still drive the main window.

- **Desktop chrome applies to the main window only.** The app menu, context menu, and tray are installed for the first/main window (`chrome: true`). Windows opened later via `openWindow` never get that chrome — install a menu yourself on a secondary window if it needs one.

- **Reuse is keyed by preset name or title.** A named preset is reused by its key; an inline preset is reused by its `title`. Two different inline presets with the same `title` are treated as the same window — give distinct titles to keep them separate.

- **Every window shows the same app icon.** `BrowserWindowOptions` has no per-window `icon` option; the manager resolves one app icon (`src/icons/favicon.ico`, then the web-app-manifest PNGs) for every window. Secondary windows can't have their own taskbar/dock icon. To change what all windows display, replace those files (and the electron-builder `build.{mac,win,linux}.icon` paths in `package.json`) and rebuild. The **tray** icon is a separate runtime thing (`src/icons/tray.png`, via `chrome.createAppTray`).

## Related

- [chrome](./chrome) · [pickers](./pickers)
