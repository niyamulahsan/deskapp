/**
 * window/config.ts - native window configuration (Deno Desktop).
 *
 * This is the FIRST thing a developer sets up. Tune windows here instead of
 * touching src/main.ts. Every documented Deno.BrowserWindow option is
 * supported (see https://docs.deno.com/runtime/desktop/windows/).
 *
 * Each entry in `windows` becomes one native window. The first entry is the
 * main window; subsequent entries open additional (independent) windows. Add
 * or remove entries to add or remove windows — no code changes in main.ts.
 *
 * `route` is the in-app path each window should navigate to on startup (the
 * frontend router serves it). Omit it to stay on the app root "/".
 *
 * Notes:
 *   - width / height    : initial size in logical pixels (default 800x600).
 *   - x / y             : initial position; the window is centered if omitted.
 *   - frameless,
 *     noActivate,
 *     transparentTitlebar: creation-only options.
 */

export interface WindowPreset {
  /** Window title. Falls back to the app name if unset. */
  title: string;
  /** Initial width in logical pixels. */
  width: number;
  /** Initial height in logical pixels. */
  height: number;
  /** Initial horizontal position; centered if omitted. */
  x?: number;
  /** Initial vertical position; centered if omitted. */
  y?: number;
  /** Whether the user can resize the window. */
  resizable?: boolean;
  /** Keep the window above others. */
  alwaysOnTop?: boolean;
  /** Remove the title bar and window chrome (creation-only). */
  frameless?: boolean;
  /** Floating, non-activating panel that doesn't steal focus (creation-only). */
  noActivate?: boolean;
  /** Blend the title bar into the content (creation-only). */
  transparentTitlebar?: boolean;
  /** In-app path the window loads on startup (frontend route). */
  route?: string;
  /**
   * Install the default desktop chrome (app menu, context menu, tray) at
   * startup. Only honoured for the FIRST (main) window — openWindow() windows
   * never get it. Omit (or set `true`) to keep it, `false` to disable.
   */
  chrome?: boolean;
}

/**
 * Named window presets. Only these open at boot. The "main" entry is always
 * created first (it adopts the shutdown window); every extra entry also opens
 * as a fresh window at startup.
 *
 * Windows for runtime use (opened on a button click, a menu item, etc.) are
 * NOT declared here — pass a `WindowPreset` straight to `win.openWindow()`:
 *
 *   import { win } from "@/core/facade.ts";
 *   await win.openWindow({ title: "Help", width: 760, height: 600, route: "/help" });
 *
 * Every such window is individual: its own close (×) button closes only that
 * window. The app exits when the last window is closed.
 */
export const windows: Record<string, WindowPreset> = {
  main: {
    title: "Deskapp",
    width: 1280,
    height: 800,
    resizable: true,
    alwaysOnTop: false,
    route: "/",
    chrome: true,
  },
};

/** The main (first-created) window preset. */
export const windowConfig: WindowPreset = windows.main;
