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
