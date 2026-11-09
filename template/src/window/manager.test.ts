import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listeners: Record<string, Function> = {};
  const webContents = { on: vi.fn(), setWindowOpenHandler: vi.fn(), executeJavaScript: vi.fn(async () => undefined), send: vi.fn() };
  const winInstance = {
    id: 1,
    loadURL: vi.fn(async () => undefined),
    loadFile: vi.fn(async () => undefined),
    once: vi.fn((ev: string, fn: Function) => {
      listeners[ev] = fn;
    }),
    on: vi.fn((ev: string, fn: Function) => {
      listeners[ev] = fn;
    }),
    show: vi.fn(),
    hide: vi.fn(),
    isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false),
    restore: vi.fn(),
    focus: vi.fn(),
    setMenu: vi.fn(),
    webContents,
    reload: vi.fn(),
  };
  const BrowserWindow = vi.fn(function () {
    return winInstance;
  }) as any;
  BrowserWindow.getAllWindows = vi.fn(() => []);
  return { winInstance, BrowserWindow };
});

vi.mock("electron", () => ({
  BrowserWindow: mocks.BrowserWindow,
  app: { quit: vi.fn(), getPath: () => "/tmp", getAppPath: () => "/tmp", isPackaged: true },
}));
vi.mock("@/window/config", () => ({
  windowConfig: { title: "App", width: 800, height: 600, route: "/" },
  windows: {},
}));

import { win } from "@/window/manager";

describe("window manager (win)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the window API surface", () => {
    expect(typeof win.createWindow).toBe("function");
    expect(typeof win.getWindow).toBe("function");
    expect(typeof win.getWindowCount).toBe("function");
    expect(typeof win.openWindow).toBe("function");
  });
});
