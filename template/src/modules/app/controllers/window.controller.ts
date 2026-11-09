import { app } from "electron";
import { config } from "@/core/config";
import { chrome, type DesktopWindow, win } from "@/core/facade";

/** The window the controller acts on (the main window by default). */
function targetWindow(): DesktopWindow | undefined {
  return win.getWindow();
}

/* ---------------------------------------------------------------------------
 * Window controls
 * ------------------------------------------------------------------------ */

export const setTitle = (title: unknown): void => {
  const w = targetWindow();
  if (w && typeof title === "string") w.setTitle(title);
};

export const setSize = (width: unknown, height: unknown): void => {
  const w = targetWindow();
  if (w && typeof width === "number" && typeof height === "number") {
    w.setSize(width, height);
  }
};

export const toggleAlwaysOnTop = (): void => {
  const w = targetWindow();
  if (!w) return;
  w.setAlwaysOnTop(!w.isAlwaysOnTop());
};

export const focus = (): void => {
  targetWindow()?.focus();
};

export const open = async (name: unknown): Promise<boolean> => {
  if (typeof name !== "string") return false;
  const opened = await win.openWindow(name);
  return Boolean(opened);
};

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
    height: 720
  });

  if (!opened) return false;
  opened.loadURL(parsed.href); // Electron uses loadURL instead of navigate
  return true;
};

/* ---------------------------------------------------------------------------
 * Menus, Tray, Dialogs
 * ------------------------------------------------------------------------ */

export const installMenu = (): void => {
  const w = targetWindow();
  if (w) chrome.installAppMenu(w);
};

export const showContextMenu = (): void => {
  // Context menu is handled natively by Electron in window/native.ts
  // No manual call needed from the frontend.
};

export const createTray = (): boolean => {
  chrome.createAppTray();
  return true;
};

export const confirmSomething = async (message: unknown): Promise<boolean> => {
  return await chrome.confirmDialog(typeof message === "string" ? message : "Are you sure?");
};

export const alertSomething = async (message: unknown): Promise<void> => {
  await chrome.alertDialog(typeof message === "string" ? message : "Hello from Deskapp");
};

export const quit = (): void => {
  app.quit();
};

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
  quit
};
