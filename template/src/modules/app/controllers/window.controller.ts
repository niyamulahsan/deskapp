/**
 * window.controller.ts (app module) - example: drive native desktop features
 * (window, menu, tray, dialog) from the frontend.
 *
 * This is a reference/template showing how ANY module controller can expose
 * native desktop APIs to the webview through the bindings mechanism. The
 * native APIs stay centralized in the window layer (src/window) and are
 * surfaced via the facade; the controller is
 * only a thin bridge so the frontend can trigger them.
 *
 * Only DOCUMENTED Deno Desktop methods are used (see
 * https://docs.deno.com/runtime/desktop/):
 *   - Windows : https://docs.deno.com/runtime/desktop/windows/
 *   - Menus   : https://docs.deno.com/runtime/desktop/menus/
 *   - Tray    : https://docs.deno.com/runtime/desktop/tray_and_dock/
 *   - Dialogs : https://docs.deno.com/runtime/desktop/dialogs/
 *
 * Frontend calls (auto-discovered by the bindings registry):
 *   bindings['app.window.setTitle']('New Title')
 *   bindings['app.window.setSize'](1024, 768)
 *   bindings['app.window.toggleAlwaysOnTop']()
 *   bindings['app.window.openUrl']('https://vite.dev')
 *   bindings['app.window.installMenu']()
 *   bindings['app.window.createTray']()
 *   bindings['app.window.confirmSomething']()
 *   bindings['app.window.quit']()
 *
 * All run in-process (no HTTP/IPC): webview -> controller -> facade -> native.
 */

import {
  win,
  chrome,
  type DesktopWindow,
  type MenuItem,
} from "@/core/facade.ts";

/** The window the controller acts on (the main window by default). */
function targetWindow(): DesktopWindow | undefined {
  return win.getWindow();
}

/* ---------------------------------------------------------------------------
 * Window controls (methods on the BrowserWindow object)
 * ------------------------------------------------------------------------ */

/** Set the window title. Receives the new title from the frontend. */
export const setTitle = (title: unknown): void => {
  const win = targetWindow();
  if (win && typeof title === "string") win.setTitle(title);
};

/** Resize the window. Receives width/height from the frontend. */
export const setSize = (width: unknown, height: unknown): void => {
  const win = targetWindow();
  if (win && typeof width === "number" && typeof height === "number") {
    win.setSize(width, height);
  }
};

/** Toggle the window always-on-top flag. */
export const toggleAlwaysOnTop = (): void => {
  const win = targetWindow();
  if (!win) return;
  win.setAlwaysOnTop(!win.isAlwaysOnTop());
};

/** Bring focus to the window. */
export const focus = (): void => {
  targetWindow()?.focus();
};

/** Open an additional window from a preset in src/window/config.ts. */
export const open = async (name: unknown): Promise<boolean> => {
  if (typeof name !== "string") return false;
  const opened = await win.openWindow(name);
  return Boolean(opened);
};

/**
 * Open an external website in its own window. Reusing the same hostname shows
 * the already-open window instead of opening a duplicate. Invalid or non
 * http(s) URLs are ignored.
 */
export const openUrl = async (url: unknown): Promise<boolean> => {
  if (typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const opened = await win.openWindow({
    title: parsed.hostname,
    width: 1024,
    height: 720,
  });
  if (!opened) return false;
  opened.navigate(parsed.href);
  return true;
};

/* ---------------------------------------------------------------------------
 * Application menu (native menu bar / window menu)
 * ------------------------------------------------------------------------ */

/**
 * Install the native application menu on the target window. Menu items with
 * an `id` fire a `menuclick` event (wired in `installMenu`); `role` items are
 * handled by the OS. The menu is rebuilt and re-applied to reflect state.
 */
export const installMenu = (): void => {
  const win = targetWindow();
  if (!win) return;

  const items: MenuItem[] = [
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

  win.setApplicationMenu(items);
  setMenuClickHandler(win);
};

/** Wire `menuclick` events to handlers (called once when the menu is set). */
function setMenuClickHandler(target: DesktopWindow): void {
  target.addEventListener("menuclick", async (e) => {
    const detail = e.detail as { id?: string; } | undefined;
    switch (detail?.id) {
      case "openSettings":
        await win.openWindow({ title: "Settings", width: 420, height: 320 });
        break;
      default:
        break;
    }
  });
}

/* ---------------------------------------------------------------------------
 * Context menu (right-click popup)
 * ------------------------------------------------------------------------ */

/** Show a right-click context menu at the given screen position. */
export const showContextMenu = (x: unknown, y: unknown): void => {
  const win = targetWindow();
  if (!win) return;
  const items: MenuItem[] = [
    { item: { label: "Copy", id: "copy", enabled: true } },
    { item: { label: "Paste", id: "paste", enabled: true } },
    "separator",
    { item: { label: "Reload", id: "reload", enabled: true } },
  ];
  win.showContextMenu(Number(x), Number(y), items);
  win.addEventListener("contextmenuclick", (e) => {
    const detail = e.detail as { id?: string; } | undefined;
    if (detail?.id === "reload") win.reload();
  });
};

/* ---------------------------------------------------------------------------
 * Tray (system status-area icon)
 * ------------------------------------------------------------------------ */

/**
 * Create the system tray icon + menu. Icon bytes should come from a real PNG
 * (e.g. read once at startup). Returns the created tray or null.
 */
export const createTray = (): boolean => {
  const tray = chrome.createTray();
  if (!tray) return false;

  // Icon bytes must be PNG; load once (e.g. await Deno.readFile) in a real app.
  // tray.setIcon(await Deno.readFile(new URL("../icons/tray.png", import.meta.url)));

  tray.setTooltip("Deskapp");

  const menu: MenuItem[] = [
    { item: { label: "Show window", id: "show", enabled: true } },
    { item: { label: "Open Settings", id: "settings", enabled: true } },
    "separator",
    { item: { label: "Quit", id: "quit", enabled: true } },
  ];
  tray.setMenu(menu);

  tray.addEventListener("click", () => targetWindow()?.show());
  tray.addEventListener("menuclick", (e) => {
    const detail = e.detail as { id?: string; } | undefined;
    switch (detail?.id) {
      case "show":
        targetWindow()?.show();
        break;
      case "settings":
        void win.openWindow({ title: "Settings", width: 420, height: 320 });
        break;
      case "quit":
        Deno.exit(0);
        break;
      default:
        break;
    }
  });

  return true;
};

/* ---------------------------------------------------------------------------
 * Dialogs (native alert / confirm / prompt)
 * ------------------------------------------------------------------------ */

/** Show a native confirmation dialog; returns OK/Cancel. */
export const confirmSomething = (message: unknown): boolean => {
  return chrome.confirmDialog(typeof message === "string" ? message : "Are you sure?");
};

/** Show a native alert dialog. */
export const alertSomething = (message: unknown): void => {
  chrome.alertDialog(typeof message === "string" ? message : "Hello from Deno Desktop");
};

/* ---------------------------------------------------------------------------
 * App / quit
 * ------------------------------------------------------------------------ */

/** Quit the whole app (all windows + runtime). */
export const quit = (): void => {
  Deno.exit(0);
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = {
  setTitle,
  setSize,
  toggleAlwaysOnTop,
  focus,
  open,
  openUrl,
  installMenu,
  showContextMenu,
  createTray,
  confirmSomething,
  alertSomething,
  quit,
};
