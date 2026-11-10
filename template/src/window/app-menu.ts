import { Menu } from "electron";
import { type DesktopWindow, win as winApi } from "@/window/manager";

export function removeAppMenu(win: DesktopWindow): void {
  win.setMenu(null);
  // On Windows/Linux this controls the application menu bar.
  Menu.setApplicationMenu(null);
}

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
export function toElectronMenu(items: MenuItem[]): Electron.MenuItemConstructorOptions[] {
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

export function defaultMenuItems(): MenuItem[] {
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

export function installAppMenu(win: DesktopWindow): void {
  // Set menu for the main window (also sets application menu on Windows/Linux).
  const menu = Menu.buildFromTemplate(toElectronMenu(defaultMenuItems()));
  win.setMenu(menu);
  Menu.setApplicationMenu(menu);
}
