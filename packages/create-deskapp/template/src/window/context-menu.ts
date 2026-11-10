import { Menu } from "electron";
import type { DesktopWindow } from "@/window/manager";

export function installContextMenu(win: DesktopWindow): void {
  win.webContents.on("context-menu", (_event, _params) => {
    const menu = Menu.buildFromTemplate([
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { label: "Reload", click: () => win.reload() }
    ]);
    menu.popup({ window: win });
  });
}

export function disableContextMenu(win: DesktopWindow): void {
  // Suppress default/custom context menu when explicitly disabled.
  win.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });
}
