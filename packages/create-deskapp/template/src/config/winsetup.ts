/**
 * Window setup/config — edit this file to configure app windows (0 hassle).
 * Each entry in `windows` becomes a native BrowserWindow at boot.
 * The first entry ("main") is the primary window.
 *
 * For runtime windows (opened on demand), pass a `WindowPreset` to `win.openWindow()`.
 */

import { config } from "@/core/config";

export type DevToolsMode = "bottom" | "right" | "left" | "undocked" | "detach";

export const windowDev = {
  /**
   * Auto-open DevTools in development only (never in production/packaged).
   * Set mode: "bottom" | "right" | "left" | "undocked" | "detach", or "none" to disable.
   */
  devTools: "bottom" as DevToolsMode | "none"
};

export interface ChromeParts {
  /** Application/window menu. */
  appMenu?: boolean;
  /** Right-click context menu. */
  contextMenu?: boolean;
  /** System tray icon/menu (windowed). */
  tray?: boolean;
}

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
   * Desktop chrome for the FIRST (main) boot window only.
   * - `true` / omitted: app menu + context menu + tray (default)
   * - `false`: none
   * - object: granular control, e.g. `{ appMenu: true, contextMenu: true, tray: false }`
   *   (omitted parts default to `false` when an object is provided)
   */
  chrome?: boolean | ChromeParts;
}

/** Normalize chrome config to explicit part flags. */
export function resolveChrome(chrome: WindowPreset["chrome"]): Required<ChromeParts> {
  if (chrome === false) return { appMenu: false, contextMenu: false, tray: false };
  if (chrome === true || chrome === undefined) return { appMenu: true, contextMenu: true, tray: true };
  return {
    appMenu: !!chrome.appMenu,
    contextMenu: !!chrome.contextMenu,
    tray: !!chrome.tray,
  };
}

/**
 * Named window presets. Only these open at boot. The "main" entry is always
 * created first; every extra entry also opens as a fresh window at startup.
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
