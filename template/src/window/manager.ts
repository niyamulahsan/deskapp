import path from "node:path";
import { app, BrowserWindow, nativeImage } from "electron";
import { closeDatabase } from "@/core/database/connection";
import { type WindowPreset, windowConfig, windows as windowPresets } from "@/window/config";

function resolveWindowIcon(): Electron.NativeImage | string | undefined {
  const bases = app.isPackaged
    ? [app.getAppPath()]
    : [path.resolve(app.getAppPath(), "..", ".."), app.getAppPath(), process.cwd()];

  const candidates: string[] = [];
  for (const root of Array.from(new Set(bases))) {
    const base = path.join(root, "src", "icons");
    candidates.push(
      path.join(base, "favicon.ico"),
      path.join(base, "web-app-manifest-512x512.png"),
      path.join(base, "web-app-manifest-192x192.png"),
      path.join(base, "favicon-96x96.png"),
    );
  }

  for (const iconPath of candidates) {
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) return icon;
    } catch {}
  }
  // Fallback: no custom icon found (Electron default will be used).
  return undefined;
}

// We map your custom options to Electron's expected options
export interface BrowserWindowOptions extends WindowPreset {}

// We alias Electron's BrowserWindow so the rest of your app thinks it's DesktopWindow
export type DesktopWindow = BrowserWindow;

const windows = new Map<number, BrowserWindow>();
const namedWindows = new Map<string, BrowserWindow>();
let mainWindowId: number | undefined;
let defaultPreloadPath: string | undefined;

function resolvePreloadPath(explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (defaultPreloadPath) return defaultPreloadPath;
  // Bundle-safe default: out/main -> ../preload/index.cjs
  return path.join(__dirname, "../preload/index.cjs");
}

function resolveRendererIndex(): string {
  return path.join(app.getAppPath(), "src", "ui", "dist", "index.html");
}

function isDevServer(): string | undefined {
  if (!app.isPackaged && process.env.NODE_ENV === "development") {
    return "http://localhost:5173";
  }
  return undefined;
}

function createWindow(options?: BrowserWindowOptions, name?: string, preloadPath?: string): DesktopWindow | undefined {
  const preset = options ?? windowConfig;
  const resolvedPreload = resolvePreloadPath(preloadPath);
  if (resolvedPreload && !defaultPreloadPath) defaultPreloadPath = resolvedPreload;

  const icon = resolveWindowIcon();
  const win = new BrowserWindow({
    title: preset.title,
    width: preset.width,
    height: preset.height,
    x: preset.x,
    y: preset.y,
    resizable: preset.resizable ?? true,
    alwaysOnTop: preset.alwaysOnTop ?? false,
    frame: !preset.frameless,
    transparent: preset.transparentTitlebar ?? false,
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: resolvedPreload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const winId = win.id;
  windows.set(winId, win);
  if (mainWindowId === undefined) mainWindowId = winId;
  if (name) namedWindows.set(name, win);

  win.on("closed", () => {
    windows.delete(winId);
    for (const [n, w] of namedWindows) {
      if (w === win) namedWindows.delete(n);
    }
    if (mainWindowId === winId) {
      mainWindowId = windows.keys().next().value;
    }
    if (windows.size === 0) {
      shutdownApp("all windows closed");
    }
  });

  return win;
}

async function openWindow(presetOrName: string | WindowPreset): Promise<DesktopWindow | undefined> {
  const preset = typeof presetOrName === "string" ? windowPresets[presetOrName] : presetOrName;
  if (!preset) return undefined;

  const key = typeof presetOrName === "string" ? presetOrName : preset.title;
  const existing = namedWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const win = createWindow(preset, key);
  if (!win) return undefined;

  win.once("ready-to-show", () => {
    if (!win.isDestroyed()) win.show();
  });

  const devUrl = isDevServer();
  if (devUrl) {
    await win.loadURL(`${devUrl}${preset.route || "/"}`);
  } else {
    await win.loadFile(resolveRendererIndex());
  }

  return win;
}

function shutdownApp(reason: string): void {
  console.log(`[desktop] shutting down (${reason})`);
  try {
    closeDatabase();
  } finally {
    app.quit();
  }
}

function getWindow(id?: number): DesktopWindow | undefined {
  if (id === undefined) {
    return mainWindowId === undefined ? undefined : windows.get(mainWindowId);
  }
  return windows.get(id);
}

function getWindowCount(): number {
  return windows.size;
}

function watchFrontend(_distPath: string, _onChange: () => void): void {
  // Vite handles HMR natively in Electron dev mode. No need to manually poll.
}

export const win = {
  createWindow,
  getWindow,
  getWindowCount,
  openWindow,
  watchFrontend
};
