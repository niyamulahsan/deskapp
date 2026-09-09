# `win` — window lifecycle

Imported from the facade: `import { win } from "@/core/facade.ts"`.

Creates, looks up, and counts windows. Presets live in `src/window/config.ts`. See [Windows & Native APIs](../guide/windows).

## The three types — how they relate

Before using the functions, understand the three names you'll meet. There is one **input shape**, one **output shape**, and one **input-or-output** shape:

| Type | What it is | Where it appears |
| --- | --- | --- |
| `BrowserWindowOptions` | The **build options**: title, size, position, flags. Pure input. | Passed to `createWindow`. |
| `WindowPreset` | A `BrowserWindowOptions` **plus a `route`** (which app page to load). Also an input. | Passed to `openWindow`, and stored in `src/window/config.ts`. |
| `DesktopWindow` | The **actual open window** you get back. It's the return value — you call methods on it (`setTitle`, `focus`, `navigate`, ...). It is *never* a parameter. | Returned by `createWindow`, `openWindow`, `getWindow`. |

Reading a signature: **everything inside the parenthesis is what you hand in; the type after `=>` is the window you receive.**

```
win.createWindow(options?, name?)          =>      DesktopWindow | undefined
       └───── you pass options ─────┘              └── you get a window ──┘
win.openWindow(presetOrName)              => Promise<DesktopWindow | undefined>
```

## Signature

| Function | Signature | Returns |
| --- | --- | --- |
| `createWindow` | `(options?: BrowserWindowOptions, name?: string)` | `DesktopWindow \| undefined` |
| `getWindow` | `(id?: number)` | `DesktopWindow \| undefined` |
| `getWindowCount` | `()` | `number` |
| `openWindow` | `(presetOrName: string \| WindowPreset)` | `Promise<DesktopWindow \| undefined>` |
| `watchFrontend` | `(distPath: string, onChange: () => void)` | `void` |

**Inputs:**

- `options` (`BrowserWindowOptions`): title, `width`/`height`, `x`/`y`, and flags (`resizable`, `alwaysOnTop`, `frameless`, `noActivate`, `transparentTitlebar`). All optional.
- `name` (`string`): a label used to track the window by name (so reopening the same name focuses it instead of duplicating). Optional. Only meaningful for `createWindow`.
- `presetOrName` (`string | WindowPreset`): either a **preset name** declared in `src/window/config.ts` (e.g. `"settings"`), or an inline `WindowPreset` object.
- `id` (`number`): the numeric `windowId` of an open window. **No argument returns the main window.**
- `distPath` (`string`, `watchFrontend`): a directory to watch for UI rebuilds — the `src/ui/dist` output folder in dev.
- `onChange` (`() => void`, `watchFrontend`): called each time a rebuild appears in `distPath`.

**Outputs:**

- `DesktopWindow` — see the type below. This is the object you keep and call methods on.
- `Promise<DesktopWindow | undefined>` — `openWindow` is async; always `await` it.
- `undefined` — all *create/get* functions return `undefined` (or resolve it) when not running under `deno desktop`, or the requested window doesn't exist.

> [!NOTE] Same window, same methods
> `getWindow()`, `createWindow()` and `await openWindow()` all hand you the **same `DesktopWindow` type**. Whatever methods you can call on the result of `getWindow()` (`bind`, `setTitle`, `focus`, `navigate`, `getSize`, `executeJs`, `openDevtools`, ...) you can call on the result of `openWindow()` too. The only difference is plumbing: `openWindow` is async and does extra work (binds handlers, navigates to the route) before resolving.

## `createWindow` vs `openWindow` — the key difference

> [!IMPORTANT] You rarely call `createWindow` yourself
> `createWindow` is **already used internally** — the backend entrypoint (`src/main.ts`) calls it at boot for every window declared in `src/window/config.ts`, so your **main window is created for you automatically**. In app code you almost always want the other functions:
>
> - **`openWindow`** — open an additional window on demand (settings, about, reports). This is the one to reach for.
> - **`getWindow()`** — grab the existing main window (with no argument) so you can drive it: `win.getWindow()?.setTitle(...)`.
> - **`getWindowCount()`** — how many windows are open.
>
> Only reach for `createWindow` when you need a raw, hand-managed bare window (e.g. an off-app window you'll `navigate` to an external URL) and `openWindow`'s preset/binding/routing convenience doesn't fit.

| | `createWindow` | `openWindow` |
| --- | --- | --- |
| **What it does** | Opens a bare window from raw options. | Opens the preset, **binds your controller handlers** onto it, and **navigates it to its `route`**. |
| **Input** | `BrowserWindowOptions` (no routing) | Preset name **or** `WindowPreset` (has `route`) |
| **Reuse** | Always opens a new window. | Reopening the same preset name focuses the already-open window instead of duplicating. |
| **When to use** | A plain/off-app window you'll drive manually — e.g. load an external website with `navigate`. | A normal **in-app** window with a router route and working bindings — settings, about, reports. |

> Rule of thumb: use `openWindow` for anything that loads an app page; use `createWindow` only for a bare window you manage by hand — and remember the framework already used `createWindow` for the main window at startup.

## Types

```ts
interface BrowserWindowOptions {
  title?: string; width?: number; height?: number;
  x?: number; y?: number;
  resizable?: boolean; alwaysOnTop?: boolean; frameless?: boolean;
  noActivate?: boolean; transparentTitlebar?: boolean;
}

interface WindowPreset extends BrowserWindowOptions {
  route?: string; // the app route to navigate to (e.g. "/settings")
}

interface DesktopWindow {
  windowId: number;
  bind(name: string, handler: (...args: unknown[]) => unknown): void;
  // EventTarget
  addEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
  // lifecycle
  show(): void; hide(): void; focus(): void; close(): void;
  reload(): void; isClosed(): boolean; isVisible(): boolean;
  // geometry
  getSize(): [number, number]; setSize(width: number, height: number): void;
  getPosition(): [number, number]; setPosition(x: number, y: number): void;
  isResizable(): boolean; setResizable(resizable: boolean): void;
  isAlwaysOnTop(): boolean; setAlwaysOnTop(alwaysOnTop: boolean): void;
  // content
  setTitle(title: string): void;
  navigate(url: string): void;
  setApplicationMenu(items: unknown[]): void;
  showContextMenu(x: number, y: number, items: unknown[]): void;
  executeJs(code: string): Promise<unknown>;
  openDevtools(opts?: { deno?: boolean; renderer?: boolean }): void;
}
```

## Use cases

### Open a config-preset window (settings / about / reports)

Use `openWindow` with a name declared in `src/window/config.ts` — reopening it focuses the already-open window instead of duplicating.

```ts
import { win } from "@/core/facade.ts";

// from a menu click, tray item, or controller handler:
await win.openWindow("settings");
await win.openWindow("about");
```

Here `"settings"` is the `name` that must exist as a key in the `windows` object in `src/window/config.ts`.

### Open a one-off window on demand (help / preview / detail)

Pass an inline `WindowPreset`; the window gets handlers bound and navigates to its `route`.

```ts
async function previewItem(item: Item) {
  const w = await win.openWindow({ title: item.name, width: 900, height: 640, route: "/preview" });
  if (w) w.focus();
}
```

`w` is the returned `DesktopWindow`. The object passed in is the `WindowPreset`.

### Open an external website in its own window

`openWindow` gives you the instance, then `navigate` jumps it to any URL — good for docs/support links.

```ts
const w = await win.openWindow({ title: "vite.dev", width: 1024, height: 720 });
if (w) w.navigate("https://vite.dev");
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
console.log(win.getWindowCount()); // 0 outside deno desktop, else # of tracked windows
```

### Feature-detect `deno desktop` (safe in tests / CLI)

At boot the framework already created the main window, so the simplest check that has **no side effects** is `getWindow()` — it returns the main window under `deno desktop`, and `undefined` outside it:

```ts
const main = win.getWindow();
if (!main) {
  console.log("not running under deno desktop — skipping window setup");
}
```

> Avoid probing with `createWindow` just to detect the runtime — if it *does* find a window it opens one, which is a side effect you didn't ask for. Use the return value of an operation you were doing anyway (e.g. `await win.openWindow(...)`), or `getWindow()` above.

## Notes

- The app quits only when the **last** tracked window closes; each window's close (×) button closes just that window.
- `createWindow`/`openWindow` never throw when the runtime has no `Deno.BrowserWindow` — they return `undefined`, so callers can skip window work in tests or plain `deno run`.
- Reopening the same preset name (or same inline `title`) shows the open window instead of creating a duplicate.

> [!TIP] `watchFrontend` is a dev-time helper
> `watchFrontend` polls `distPath` and calls `onChange` every time the UI rebuilds. `deno task dev` runs `vite build --watch` and sets `FRONTEND_WATCH=1`, which wires it to `win.getWindow()?.reload()` in `src/main.ts` — so editing SCSS/Vue files refreshes the open window without touching anything. Nothing calls it in production (`serve`, packaged builds).

## Known quirks with multiple windows

These behaviours come from the framework's window manager and are worth knowing before you build a multi-window UI.

- **All windows share one process.** There is no per-window backend. State lives in the shared Deno runtime, so any window can read/write the same backend state — keep that in mind if you want per-window isolation.

- **The first window is "adopted", not created.** The very first `createWindow`/`openWindow` result *adopts* the implicit startup window; only later calls open genuinely new OS windows. So opening two *named* presets after boot yields one adopted window plus real new ones.

- **A window without at least one peer lets the app quit.** The process exits when the **last** tracked window closes. Closing an extra window (that's not the main) keeps the app running as long as the main is still open.

- **The main window is only "main" while it's open.** `getWindow()` (no argument) returns the first-created window. If that window is closed, the main-window slot is cleared — it is **not** reassigned to another window, so `getWindow()` returns `undefined` until one is created again. Don't cache the main window across a close; re-query `getWindow()` when you need it.

- **Tray and app-menu actions act on the main window only.** `win.getWindow()` is what tray clicks, "Show window", and the menu "Open Settings" target. If you reorder windows so a different one is visually "front", these shortcuts still drive the main window.

- **Desktop chrome applies to the main window only.** The app menu, context menu, and tray are installed for the first/main window (`chrome: true`). Windows opened later via `openWindow` never get that chrome — they get bindings and routing, but no menu/tray. Install a menu yourself on a secondary window if it needs one.

- **Reuse is keyed by preset name or title.** A named preset is reused by its key; an inline preset is reused by its `title`. Two different inline presets with the same `title` are treated as the same window — give distinct titles to keep them separate.

- **There is no per-window icon.** `BrowserWindowOptions` (in Deno Desktop and therefore in `createWindow`/`openWindow`) has no icon option — every window shows the same **app icon**, configured in `deno.json` under `desktop.app.icons` (Windows: `favicon.ico`; macOS/Linux: a PNG) and baked into the bundle. Secondary windows can't have their own taskbar/dock icon. To change what all windows display, replace those icon files and rebuild. In plain `deno desktop` dev runs the icon comes from that config too — but OS caches and Windows' `.ico` requirement are the usual culprits when the wrong/generic icon shows. The **tray** icon is a separate runtime thing (`src/icons/tray.png`, via `chrome.createAppTray`).

> [!IMPORTANT] Known multi-window problems at the Deno Desktop level
> The **default setup — one `main` window running the SPA at `route: "/"` with in-process bindings — is fully functional** and unaffected by any of this. The framework-level regressions in the [Windows & Native APIs guide](../guide/windows#known-quirks) only bite in the exact combination of OS + Deno version + secondary windows: a version-specific close-button bug (Deno 2.9.6 on Windows), secondary-window `close` events firing globally on macOS, and macOS `close()`/`hide()` hangs. In all cases the window manager keys handlers on the `windowId` and only quits at zero tracked windows, so your app logic above holds — the quirks are in the underlying OS/webview layer and only surface when you add secondary windows on the affected platforms.

## Related

- [chrome](./chrome) · [pickers](./pickers)