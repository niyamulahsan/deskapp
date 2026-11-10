import fs from "node:fs";
import path from "node:path";
import { app, Menu, nativeImage, Tray } from "electron";
import { config } from "@/core/config";
import { win as winApi } from "@/window/manager";

export interface DesktopTray extends Tray {}

let tray: Tray | null = null;

// 16x16 red dot (known-good data URL) as guaranteed fallback so tray can still appear.
const FALLBACK_TRAY_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABYSURBVHgB7ZMxDoAgDEXfQI7gERzFQw5u5BWMg4maNB8WBgeTPqHJb9qfAjgQCLZYkGIgnSWmmOMcRZ6LzF1k65s6UKMo15W1X9mHe3vK+3xM4QcM0wUogx/2yq6l8gAAAABJRU5ErkJggg==";

function getTrayIconCandidates(): string[] {
  // In dev, main bundle runs from out/main so app.getAppPath() can resolve to out/main;
  // project assets live at the project root (../../ from out/main). In packaged builds,
  // app.getAppPath() points to the app root (or asar root) where src/icons is packaged.
  const bases = app.isPackaged
    ? [app.getAppPath()]
    : [path.resolve(app.getAppPath(), "..", ".."), app.getAppPath(), process.cwd()];

  const candidates: string[] = [];
  for (const root of Array.from(new Set(bases))) {
    const base = path.join(root, "src", "icons");
    candidates.push(
      path.join(base, "tray.png"),
      path.join(base, "favicon-96x96.png"),
      path.join(base, "favicon.ico"),
      path.join(base, "web-app-manifest-192x192.png"),
      path.join(base, "web-app-manifest-512x512.png"),
    );
  }
  // Last resort: executable icon (Electron icon in dev, app icon when packaged).
  candidates.push(process.execPath);
  return candidates;
}

export function createTray(): Tray | undefined {
  if (tray && !(tray as any).isDestroyed?.()) return tray;
  try {
    for (const iconPath of getTrayIconCandidates()) {
      try {
        // Prefer passing a file path string directly (supported by Electron Tray).
        if (fs.existsSync(iconPath)) {
          try {
            tray = new Tray(iconPath);
            return tray;
          } catch {}
        }
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          const size = icon.getSize();
          const trayIcon = size.width > 32 ? icon.resize({ width: 16, height: 16 }) : icon;
          tray = new Tray(trayIcon);
          return tray;
        }
      } catch {
        // try next candidate
      }
    }

    // Guaranteed fallback so tray still appears even if files/exe icon can't be loaded.
    try {
      const fallback = nativeImage.createFromDataURL(FALLBACK_TRAY_ICON);
      if (!fallback.isEmpty()) {
        tray = new Tray(fallback);
        return tray;
      }
    } catch {}

    return undefined;
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
      },
    },
    {
      label: "Open Settings",
      click: () => {
        void winApi.openWindow({ title: "Settings", width: 420, height: 320 });
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
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
      { label: "Quit", click: () => app.quit() },
    ]),
  );

  return t;
}

export function hideDock(): void {
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }
}
