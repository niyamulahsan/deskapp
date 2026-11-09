import fs from "node:fs";
import path from "node:path";
import { app, BrowserWindow, dialog } from "electron";
import { bindAll } from "@/core/api/registry";
import { config } from "@/core/config";
import { loadEnv } from "@/core/env";
import { chrome, cron, db, win } from "@/core/facade";
import { storage } from "@/core/utils/storage";
import { windows } from "@/window/config";

function logFatal(err: unknown): void {
  const msg = err instanceof Error ? `${err.stack || err.message}` : String(err);
  console.error("[desktop][fatal]", msg);
  const appName = config?.appName || "Deskapp";
  const logName = `${config?.appKebab || "deskapp"}-startup.log`;
  try {
    const logFile = path.join(app.getPath("userData"), logName);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
  try {
    dialog.showErrorBox(`${appName} failed to start`, `${msg}\n\nLog: ${path.join(app.getPath("userData"), logName)}`);
  } catch {}
}

process.on("uncaughtException", (err) => logFatal(err));
process.on("unhandledRejection", (reason) => logFatal(reason));

function getPreloadPath(): string {
  return path.join(__dirname, "../preload/index.cjs");
}

function getRendererIndexPath(): string {
  return path.join(app.getAppPath(), "src", "ui", "dist", "index.html");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 1. Load .env
      loadEnv();

      // 2. Boot the backend
      console.log("[desktop] booting local stack (db)");
      await db.init();
      await storage.init();
      bindAll();

      // 3. Handle UI vs Headless
      if (config.ui.enabled) {
        let isMain = true;
        const preloadPath = getPreloadPath();
        const isDev = !app.isPackaged && process.env.NODE_ENV === "development";
        const devUrl = isDev ? "http://localhost:5173" : undefined;

        console.log(`[desktop] preload: ${preloadPath}`);
        for (const [name, preset] of Object.entries(windows)) {
          const created = win.createWindow(preset, name, preloadPath);
          if (!created) continue;

          // Show when ready to avoid a blank flash.
          created.once("ready-to-show", () => {
            if (!created.isDestroyed()) created.show();
          });

          if (isMain && preset.chrome !== false) {
            chrome.setupDesktopChrome(created);
          }
          isMain = false;

          if (devUrl) {
            const route = preset.route || "/";
            await created.loadURL(`${devUrl}${route}`);
            if (isDev) {
              created.webContents.openDevTools({ mode: "bottom" });
            }
          } else {
            await created.loadFile(getRendererIndexPath());
          }
        }
      } else {
        // Headless mode: No windows, just a tray icon.
        console.log("[desktop] headless mode - running in tray");
        chrome.hideDock();
        chrome.createHeadlessTray();
      }

      app.on("before-quit", () => {
        db.close();
        cron.stop();
      });
    } catch (err) {
      logFatal(err);
      app.quit();
    }
  });

  // In Electron, if we don't explicitly call app.quit() here,
  // the app stays alive in the background (perfect for tray/headless).
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && config.ui.enabled) {
      app.quit();
    }
  });
}
