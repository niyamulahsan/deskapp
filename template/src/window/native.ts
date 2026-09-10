/**
 * window/native.ts - desktop-native APIs beyond windows: tray, menu item
 * types, dialog helpers, and one-shot "desktop chrome" setup.
 *
 * These are desktop-only globals on `Deno` / the global scope (available under
 * `deno desktop` but not base Deno or tests), so they are resolved
 * structurally at runtime, mirroring how `manager.ts` wraps `Deno.BrowserWindow`.
 *
 * Developers import these from the facade; app code never touches `Deno.*`
 * desktop globals directly.
 */

import { win as winApi, type DesktopWindow } from "@/window/manager.ts";

/** A standard OS role menu item; the OS provides label + behavior. */
export interface MenuRole {
  role: string;
}

/** A clickable menu item (fires `menuclick` / `contextmenuclick`). */
export interface MenuActionItem {
  item: {
    label: string;
    id?: string;
    accelerator?: string;
    enabled?: boolean;
  };
}

/** A nested submenu. */
export interface MenuSubmenu {
  submenu: {
    label: string;
    items: MenuItem[];
  };
}

/** The tagged-union shape accepted by menu APIs (see Menus docs). */
export type MenuItem = MenuActionItem | MenuSubmenu | "separator" | { role: MenuRole };

/** The `Deno.Tray` surface used by the app (structural subset). */
export interface DesktopTray {
  setIcon(pngBytes: Uint8Array): void;
  setIconDark(pngBytes: Uint8Array | null): void;
  setTooltip(text: string | null): void;
  setMenu(items: unknown[] | null): void;
  destroy(): void;
  trayId: number;
  addEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
}

type TrayCtor = new () => DesktopTray;

/** `Deno` as seen by the desktop runtime (adds `Tray`). */
const desktopDeno = Deno as typeof Deno & { Tray?: TrayCtor };

/**
 * Create a system-tray icon. Returns a `DesktopTray` or undefined when not
 * running under `deno desktop`. Construction sets the icon/menu; this helper
 * only creates it (set icon bytes yourself via `tray.setIcon`).
 */
function createTray(): DesktopTray | undefined {
  if (typeof desktopDeno.Tray !== "function") return undefined;
  return new desktopDeno.Tray();
}

/** Whether the tray API is available (running under `deno desktop`). */
function isTrayAvailable(): boolean {
  return typeof desktopDeno.Tray === "function";
}

/** Show a native confirmation dialog. Returns OK/Cancel as a boolean. */
function confirmDialog(message: string): boolean {
  return confirm(message);
}

/** Show a native alert dialog. */
function alertDialog(message: string): void {
  alert(message);
}

/** Show a native prompt dialog; returns the entered string or null. */
function promptDialog(message: string, defaultValue?: string): string | null {
  return prompt(message, defaultValue);
}

/* ---------------------------------------------------------------------------
 * Default desktop chrome: application menu + tray, ready as soon as the main
 * window opens. Kept in core so startup (main.ts) and any controller share it.
 * ------------------------------------------------------------------------ */

/** The default application menu items for the main window. */
function defaultMenuItems(): MenuItem[] {
  return [
    {
      submenu: {
        label: "File",
        items: [
          { item: { label: "New", id: "new", accelerator: "CmdOrCtrl+N", enabled: true } },
          { item: { label: "Open Settings", id: "openSettings", accelerator: "CmdOrCtrl+,", enabled: true } },
          "separator",
          { role: { role: "quit" } },
        ],
      },
    },
    {
      submenu: {
        label: "Edit",
        items: [
          { role: { role: "undo" } },
          { role: { role: "redo" } },
          "separator",
          { role: { role: "cut" } },
          { role: { role: "copy" } },
          { role: { role: "paste" } },
        ],
      },
    },
  ];
}

/**
 * Install the default application menu on a window and wire its `menuclick`
 * events. Safe to call more than once (rebuilds the menu in place).
 */
function installAppMenu(win: DesktopWindow): void {
  win.setApplicationMenu(defaultMenuItems());
  win.addEventListener("menuclick", (e) => {
    const detail = e.detail as { id?: string } | undefined;
    if (detail?.id === "openSettings") {
      void winApi.openWindow({ title: "Settings", width: 420, height: 320 });
    }
  });
}

/**
 * Create the default tray icon + menu. Icon bytes are loaded from
 * `src/icons/tray.png` (include `--include=./src/icons` at build time) when
 * present; otherwise the tray is created without an icon (platforms may or
 * may not show it). No-op when tray is unavailable.
 */
function createAppTray(): DesktopTray | undefined {
  const tray = createTray();
  if (!tray) return undefined;

  tray.setTooltip("Deskapp");

  const menu: MenuItem[] = [
    { item: { label: "Show window", id: "show", enabled: true } },
    { item: { label: "Open Settings", id: "settings", enabled: true } },
    "separator",
    { item: { label: "Quit", id: "quit", enabled: true } },
  ];
  tray.setMenu(menu);

  tray.addEventListener("click", () => {
    winApi.getWindow()?.show();
    winApi.getWindow()?.focus();
  });
  tray.addEventListener("menuclick", (e) => {
    const detail = e.detail as { id?: string } | undefined;
    switch (detail?.id) {
      case "show":
        winApi.getWindow()?.show();
        break;
      case "settings":
        void winApi.openWindow({ title: "Settings", width: 420, height: 320 });
        break;
      case "quit":
        Deno.exit(0);
        break;
      default:
        break;
    }
  });

  // Optional icon (PNG bytes, not a path).
  try {
    const icon = Deno.readFileSync(new URL("../icons/tray.png", import.meta.url));
    tray.setIcon(icon);
  } catch {
    // no bundled tray icon - leave the tray icon unset
  }

  return tray;
}

/** The default right-click context menu items. */
function defaultContextMenuItems(): MenuItem[] {
  return [
    { item: { label: "Copy", id: "copy", accelerator: "CmdOrCtrl+C", enabled: true } },
    { item: { label: "Paste", id: "paste", accelerator: "CmdOrCtrl+V", enabled: true } },
    "separator",
    { item: { label: "Reload", id: "reload", accelerator: "CmdOrCtrl+R", enabled: true } },
  ];
}

/**
 * Install a default right-click context menu on a window. Handles the
 * secondary-mouse-button `mousedown` itself (the webview may not forward the
 * browser `contextmenu` event) and wires `contextmenuclick` events.
 */
function installContextMenu(win: DesktopWindow): void {
  win.addEventListener("mousedown", (e) => {
    const detail = e.detail as { button?: number; x?: number; y?: number } | undefined;
    if (detail?.button === 2) {
      win.showContextMenu(Number(detail.x), Number(detail.y), defaultContextMenuItems());
    }
  });

  win.addEventListener("contextmenuclick", (e) => {
    const detail = e.detail as { id?: string } | undefined;
    switch (detail?.id) {
      case "reload":
        win.reload();
        break;
      default:
        break;
    }
  });
}

/**
 * One-shot setup: install the app menu, context menu, and tray for the main
 * window. Call once at startup after the main window is created.
 */
function setupDesktopChrome(win: DesktopWindow): void {
  installAppMenu(win);
  installContextMenu(win);
  createAppTray();
}

/**
 * Headless (no-window) tray: for builds shipped without the frontend
 * (`--ui=skip`, DESKAPP_UI=false). Keeps the process alive as a background
 * app with a Quit action only - no window references.
 */
function createHeadlessTray(): DesktopTray | undefined {
  const tray = createTray();
  if (!tray) return undefined;

  tray.setTooltip("Deskapp (headless)");

  tray.setMenu([
    { item: { label: "Deskapp is running - no UI", id: "status", enabled: false } },
    "separator",
    { item: { label: "Quit", id: "quit", enabled: true } },
  ]);

  tray.addEventListener("menuclick", (e) => {
    const detail = e.detail as { id?: string } | undefined;
    if (detail?.id === "quit") Deno.exit(0);
  });

  // Optional icon (PNG bytes, not a path).
  try {
    const icon = Deno.readFileSync(new URL("../icons/tray.png", import.meta.url));
    tray.setIcon(icon);
  } catch {
    // no bundled tray icon - leave the tray icon unset
  }

  return tray;
}

/**
 * Remove the app from the macOS dock (part of the tray-only background app
 * pattern). No-op on Windows/Linux and when the runtimetime lacks `Deno.dock`.
 */
function hideDock(): void {
  const dockDeno = Deno as typeof Deno & { dock?: { setVisible?: (visible: boolean) => void } };
  try {
    dockDeno.dock?.setVisible?.(false);
  } catch {
    // dock API unavailable - ignore
  }
}

/**
 * chrome - desktop-native APIs: tray, dialogs, application/context menus, and
 * one-shot desktop chrome setup. Access through the facade:
 *   import { chrome } from "@/core/facade.ts";
 */
export const chrome = {
  createTray,
  isTrayAvailable,
  confirmDialog,
  alertDialog,
  promptDialog,
  defaultMenuItems,
  installAppMenu,
  createAppTray,
  defaultContextMenuItems,
  installContextMenu,
  setupDesktopChrome,
  createHeadlessTray,
  hideDock,
};
