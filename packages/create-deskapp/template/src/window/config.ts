/**
 * window/config.ts - native window configuration (Electron).
 *
 * Tune windows here instead of touching src/main.ts. Each entry in `windows`
 * becomes a native BrowserWindow. The first entry is the main window.
 *
 * `route` is the in-app path each window loads on startup (frontend router).
 * Omit it to stay on "/".
 */

import { config } from "@/core/config";

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
    title: config.appName,
    width: 900,
    height: 600,
    resizable: true,
    alwaysOnTop: false,
    route: "/",
    chrome: true
  }
};

/** The main (first-created) window preset. */
export const windowConfig: WindowPreset = windows.main;
