import path from "node:path";
import { app, dialog, Menu, nativeImage, Tray } from "electron";
import { config } from "@/core/config";
import { type DesktopWindow, win as winApi } from "@/window/manager";

export interface DesktopTray extends Tray {}
export interface MenuRole {
  role: string;
}
export interface MenuActionItem {
  item: { label: string; id?: string; accelerator?: string; enabled?: boolean };
}
export interface MenuSubmenu {
  submenu: { label: string; items: MenuItem[] };
}
export type MenuItem = MenuActionItem | MenuSubmenu | "separator" | { role: MenuRole };

// Map our custom MenuItem types to Electron's MenuItemConstructorOptions
function toElectronMenu(items: MenuItem[]): Electron.MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item === "separator") return { type: "separator" };
    if ("role" in item) return { role: item.role.role as any };
    if ("item" in item) {
      return {
        label: item.item.label,
        id: item.item.id,
        accelerator: item.item.accelerator,
        enabled: item.item.enabled,
        click: () => {
          // Forward clicks to the window's custom event if needed,
          // or handle globally
          const mainWin = winApi.getWindow();
          if (mainWin && item.item.id) {
            // Emulate Deno's event by executing custom JS or sending IPC
            mainWin.webContents.send("menu-click", item.item.id);
          }
        }
      };
    }
    if ("submenu" in item) {
      return {
        label: item.submenu.label,
        submenu: toElectronMenu(item.submenu.items)
      };
    }
    return {};
  });
}

let tray: Tray | null = null;

function getTrayIconPath(): string {
  // Bundle-safe: resolve from the app root (works in dev and packaged builds).
  return path.join(app.getAppPath(), "src", "icons", "tray.png");
}

function createTray(): Tray | undefined {
  try {
    const iconPath = getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) return undefined;
    tray = new Tray(icon);
    return tray;
  } catch {
    return undefined;
  }
}

function isTrayAvailable(): boolean {
  return true;
}

async function confirmDialog(message: string): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Cancel", "OK"],
    title: "Confirm",
    message: message
  });
  return result.response === 1;
}

async function alertDialog(message: string): Promise<void> {
  await dialog.showMessageBox({
    type: "info",
    title: "Alert",
    message: message
  });
}

async function promptDialog(message: string, defaultValue?: string): Promise<string | null> {
  // Electron doesn't have a native prompt dialog, so we'd need a custom HTML modal.
  // For now, we fallback to confirm as a stub.
  console.warn("promptDialog not natively supported in Electron");
  return null;
}

function defaultMenuItems(): MenuItem[] {
  return [
    {
      submenu: {
        label: "File",
        items: [
          { item: { label: "New", id: "new", accelerator: "CmdOrCtrl+N", enabled: true } },
          { item: { label: "Open Settings", id: "openSettings", accelerator: "CmdOrCtrl+,", enabled: true } },
          "separator",
          { role: { role: "quit" } }
        ]
      }
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
          { role: { role: "paste" } }
        ]
      }
    }
  ];
}

function installAppMenu(win: DesktopWindow): void {
  // Set menu for the main window (also sets application menu on Windows/Linux).
  const menu = Menu.buildFromTemplate(toElectronMenu(defaultMenuItems()));
  win.setMenu(menu);
  Menu.setApplicationMenu(menu);
}

function createAppTray(): Tray | undefined {
  const t = createTray();
  if (!t) return undefined;

  t.setToolTip(config.appName);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show window",
      click: () => {
        winApi.getWindow()?.show();
        winApi.getWindow()?.focus();
      }
    },
    {
      label: "Open Settings",
      click: () => {
        void winApi.openWindow({ title: "Settings", width: 420, height: 320 });
      }
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);

  t.setContextMenu(contextMenu);
  return t;
}

function installContextMenu(win: DesktopWindow): void {
  win.webContents.on("context-menu", (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { label: "Reload", click: () => win.reload() }
    ]);
    menu.popup({ window: win });
  });
}

function setupDesktopChrome(win: DesktopWindow): void {
  installAppMenu(win);
  installContextMenu(win);
  createAppTray();
}

function createHeadlessTray(): Tray | undefined {
  const t = createTray();
  if (!t) return undefined;

  t.setToolTip(`${config.appName} (headless)`);
  t.setContextMenu(
    Menu.buildFromTemplate([
      { label: `${config.appName} is running - no UI`, enabled: false },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() }
    ])
  );

  return t;
}

function hideDock(): void {
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }
}

export const chrome = {
  createTray,
  isTrayAvailable,
  confirmDialog,
  alertDialog,
  promptDialog,
  defaultMenuItems,
  installAppMenu,
  createAppTray,
  installContextMenu,
  setupDesktopChrome,
  createHeadlessTray,
  hideDock
};
