import path from "node:path";
import { app, Menu, nativeImage, Tray } from "electron";
import { config } from "@/core/config";
import { win as winApi } from "@/window/manager";

export interface DesktopTray extends Tray {}

let tray: Tray | null = null;

function getTrayIconPath(): string {
  // Bundle-safe: resolve from the app root (works in dev and packaged builds).
  return path.join(app.getAppPath(), "src", "icons", "tray.png");
}

export function createTray(): Tray | undefined {
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

export function isTrayAvailable(): boolean {
  return true;
}

export function createAppTray(): Tray | undefined {
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

export function createHeadlessTray(): Tray | undefined {
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

export function hideDock(): void {
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }
}
