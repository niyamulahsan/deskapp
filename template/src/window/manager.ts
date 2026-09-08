/**
 * window/manager.ts - Deno Desktop window manager (internal plumbing).
 *
 * Wraps the desktop-only `Deno.BrowserWindow` API behind a structural surface
 * so src/main.ts stays clean and app-level code can drive the window without
 * touching the framework entrypoint.
 *
 * Surfaced to app code through the `win` namespace on the facade:
 *   import { win } from "@/core/facade.ts";
 *   const w = await win.openWindow("settings");
 *   win.getWindow()?.focus();
 *
 * This is the low-level manager — config.ts defines window presets, native.ts
 * owns menu/tray/context-menu/dialog chrome, and facade.ts re-exports this.
 * Most code only needs config + native (via the facade), not this file.
 *
 * NOTE: The window type only exists under `deno desktop` (not the base Deno
 * lib), so it is resolved structurally at runtime and surfaced through the
 * typed `DesktopWindow` facade below.
 */

import { windowConfig, windows as windowPresets, type WindowPreset } from "@/window/config.ts";
import { bindAll } from "@/core/api/registry.ts";
import { db } from "@/core/facade.ts";

/** Subset of the documented Deno.BrowserWindow options used by the app. */
export interface BrowserWindowOptions {
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  frameless?: boolean;
  noActivate?: boolean;
  transparentTitlebar?: boolean;
}

/**
 * The window surface app-level code may use. A structural subset of the real
 * `Deno.BrowserWindow` (https://docs.deno.com/runtime/desktop/windows/),
 * plus the `bind` used by the bindings registry.
 */
export interface DesktopWindow {
  bind(name: string, handler: (...args: unknown[]) => unknown): void;
  windowId: number;

  // Events (Deno Desktop windows are EventTargets)
  addEventListener(type: string, listener: (event: { detail?: unknown; }) => void): void;
  removeEventListener(type: string, listener: (event: { detail?: unknown; }) => void): void;

  // Lifecycle
  show(): void;
  hide(): void;
  focus(): void;
  close(): void;
  reload(): void;
  isClosed(): boolean;
  isVisible(): boolean;

  // Size and position
  getSize(): [number, number];
  setSize(width: number, height: number): void;
  getPosition(): [number, number];
  setPosition(x: number, y: number): void;
  isResizable(): boolean;
  setResizable(resizable: boolean): void;
  isAlwaysOnTop(): boolean;
  setAlwaysOnTop(alwaysOnTop: boolean): void;

  // Title
  setTitle(title: string): void;

  // Navigation
  navigate(url: string): void;

  // Menus (application menu bar / context menu)
  setApplicationMenu(items: unknown[]): void;
  showContextMenu(x: number, y: number, items: unknown[]): void;

  // Run JavaScript in the webview
  executeJs(code: string): Promise<unknown>;

  // DevTools
  openDevtools(opts?: { deno?: boolean; renderer?: boolean; }): void;
}

type BrowserWindowCtor = new (options?: BrowserWindowOptions) => DesktopWindow;

/** `Deno` as seen by the desktop runtime (which adds `BrowserWindow`). */
const desktopDeno = Deno as typeof Deno & { BrowserWindow?: BrowserWindowCtor; };

/** Track every open window by its numeric `windowId` (multi-window support). */
const windows = new Map<number, DesktopWindow>();

/** Track open windows by their preset name (for `openWindow` reuse). */
const namedWindows = new Map<string, DesktopWindow>();

let mainWindowId: number | undefined;

/**
 * Create (or adopt) a window, configured from src/window/config.ts by default
 * or from the provided options for additional windows.
 *
 * Per Deno Desktop, the FIRST construction adopts the implicit startup window;
 * every subsequent construction opens a real new window. All windows share one
 * Deno runtime.
 *
 * Returns the `DesktopWindow` instance, or undefined when not running under
 * `deno desktop` (plain `deno serve` / tests), so callers can skip window work.
 */
function createWindow(options?: BrowserWindowOptions, name?: string): DesktopWindow | undefined {
  if (typeof desktopDeno.BrowserWindow !== "function") return undefined;

  const win = new desktopDeno.BrowserWindow(options ?? windowConfig);
  windows.set(win.windowId, win);
  if (mainWindowId === undefined) mainWindowId = win.windowId;
  if (name) namedWindows.set(name, win);

  // A closed window does not stop the Deno runtime on its own. Drop the
  // window from tracking. Each window is independent: clicking its close
  // button closes only that window, and the app keeps running while at least
  // one window (or the tray) is alive. The process exits only when the LAST
  // window closes.
  win.addEventListener("close", () => {
    windows.delete(win.windowId);
    for (const [n, w] of namedWindows) {
      if (w === win) namedWindows.delete(n);
    }
    if (mainWindowId === win.windowId) {
      mainWindowId = undefined;
    }
    if (windows.size === 0) {
      shutdownApp("all windows closed");
    }
  });

  return win;
}

/**
 * Open a window on demand — the reusable "show another window" API.
 *
 * Pass a named preset from src/window/config.ts, or an inline `WindowPreset`:
 *
 *   await openWindow("settings");                    // named preset (optional)
 *   await openWindow({ title: "Help", width: 760, height: 600, route: "/help" });
 *
 * The window is created, has the framework handlers bound onto it, and
 * navigates to its configured route. Reopening the same preset name shows the
 * already-open window instead of duplicating it.
 *
 * Returns the `DesktopWindow`, or undefined when the app isn't running under
 * `deno desktop`.
 */
async function openWindow(presetOrName: string | WindowPreset): Promise<DesktopWindow | undefined> {
  const preset = typeof presetOrName === "string" ? windowPresets[presetOrName] : presetOrName;
  if (!preset) {
    console.warn(`[desktop] no window preset named "${presetOrName}"`);
    return undefined;
  }

  const key = typeof presetOrName === "string" ? presetOrName : preset.title;
  const existing = namedWindows.get(key);
  if (existing && !existing.isClosed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const win = createWindow(preset, key);
  if (!win) return undefined;
  try {
    await bindAll(win);
  } catch (error) {
    console.error(`[desktop] failed to bind handlers (${key})`, error);
  }
  if (preset.route) {
    const port = Deno.env.get("DENO_SERVE_ADDRESS")?.split(":").pop();
    if (port) win.navigate(`http://127.0.0.1:${port}${preset.route}`);
  }
  return win;
}

/** Close resources and exit the desktop process cleanly. */
function shutdownApp(reason: string): void {
  console.log(`[desktop] shutting down (${reason})`);
  try {
    db.close();
  } finally {
    Deno.exit(0);
  }
}

/**
 * Look up a window by its numeric `windowId`. Call with no argument to get the
 * main (first-created) window. Returns undefined when not running under
 * `deno desktop`, the id is unknown, or the window is not tracked.
 */
function getWindow(id?: number): DesktopWindow | undefined {
  if (id === undefined) {
    return mainWindowId === undefined ? undefined : windows.get(mainWindowId);
  }
  return windows.get(id);
}

/** The number of currently tracked (open) windows. */
function getWindowCount(): number {
  return windows.size;
}

/**
 * win - window manager facade. Access through the facade:
 *   import { win } from "@/core/facade.ts";
 */
export const win = {
  createWindow,
  getWindow,
  getWindowCount,
  openWindow,
};
