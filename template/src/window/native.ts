import type { ChromeParts } from "@config/winsetup";
import { resolveChrome } from "@config/winsetup";
import { defaultMenuItems, installAppMenu, removeAppMenu } from "./app-menu";
import { disableContextMenu, installContextMenu } from "./context-menu";
import { alertDialog, confirmDialog } from "./dialogs";
import type { DesktopWindow } from "./manager";
import { createAppTray, createHeadlessTray, createTray, hideDock, isTrayAvailable } from "./tray";

export type { MenuActionItem, MenuItem, MenuRole, MenuSubmenu } from "@/window/app-menu";
export type { DesktopTray } from "@/window/tray";
export type { ChromeParts };

/**
 * Install desktop chrome for a window. Pass `parts` for granular control;
 * defaults to all enabled (backward compatible).
 */
function setupDesktopChrome(
  win: DesktopWindow,
  parts: Required<ChromeParts> = { appMenu: true, contextMenu: true, tray: true },
): void {
  if (parts.appMenu) installAppMenu(win);
  else removeAppMenu(win);
  if (parts.contextMenu) installContextMenu(win);
  else disableContextMenu(win);
  if (parts.tray) createAppTray();
}

export const chrome = {
  // Tray
  createTray,
  isTrayAvailable,
  createAppTray,
  createHeadlessTray,
  hideDock,
  // Dialogs
  confirmDialog,
  alertDialog,
  // Menu
  defaultMenuItems,
  installAppMenu,
  installContextMenu,
  // Orchestration
  setupDesktopChrome,
  resolveChrome
};
