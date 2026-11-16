import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const setTitle = vi.fn();
  const setSize = vi.fn();
  const setAlwaysOnTop = vi.fn();
  const isAlwaysOnTop = vi.fn(() => false);
  const focus = vi.fn();
  const loadURL = vi.fn();
  const winObj = { setTitle, setSize, setAlwaysOnTop, isAlwaysOnTop, focus, loadURL };
  const openWindow = vi.fn(async (_arg?: any) => winObj);
  const installAppMenu = vi.fn();
  const createAppTray = vi.fn();
  const confirmDialog = vi.fn(async () => true);
  const alertDialog = vi.fn(async () => undefined);
  const quit = vi.fn();
  return { winObj, openWindow, installAppMenu, createAppTray, confirmDialog, alertDialog, quit, setTitle, setSize, setAlwaysOnTop, isAlwaysOnTop, focus, loadURL };
});

vi.mock("electron", () => ({ app: { quit: mocks.quit } }));
vi.mock("@/core/config", () => ({ config: { appName: "Deskapp", appKebab: "deskapp" } }));
vi.mock("@/core/facade", () => ({
  chrome: {
    installAppMenu: mocks.installAppMenu,
    createAppTray: mocks.createAppTray,
    confirmDialog: mocks.confirmDialog,
    alertDialog: mocks.alertDialog,
  },
  win: { getWindow: () => mocks.winObj, openWindow: mocks.openWindow },
}));

import * as ctrl from "@/modules/app/controllers/window.controller";

describe("app window.controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes handlers", () => {
    expect(ctrl.handlers.setTitle).toBe(ctrl.setTitle);
    expect(ctrl.handlers.quit).toBe(ctrl.quit);
    expect(Object.keys(ctrl.handlers).sort()).toEqual([
      "alertSomething",
      "confirmSomething",
      "createTray",
      "focus",
      "installMenu",
      "open",
      "openUrl",
      "quit",
      "setSize",
      "setTitle",
      "showContextMenu",
      "toggleAlwaysOnTop",
    ]);
  });

  it("window controls act on the target window", () => {
    ctrl.setTitle("hi");
    expect(mocks.setTitle).toHaveBeenCalledWith("hi");
    ctrl.setSize(100, 200);
    expect(mocks.setSize).toHaveBeenCalledWith(100, 200);
    mocks.isAlwaysOnTop.mockReturnValueOnce(false);
    ctrl.toggleAlwaysOnTop();
    expect(mocks.setAlwaysOnTop).toHaveBeenCalledWith(true);
    ctrl.focus();
    expect(mocks.focus).toHaveBeenCalled();
  });

  it("open resolves presets and openUrl validates protocols", async () => {
    expect(await ctrl.open("settings")).toBe(true);
    expect(mocks.openWindow).toHaveBeenCalledWith("settings");
    expect(await ctrl.open(123 as any)).toBe(false);

    expect(await ctrl.openUrl("ftp://bad")).toBe(false);
    expect(await ctrl.openUrl("not-a-url")).toBe(false);
    expect(await ctrl.openUrl("https://example.com")).toBe(true);
    expect(mocks.loadURL).toHaveBeenCalledWith("https://example.com/");
  });

  it("menus/tray/dialog helpers delegate to chrome", async () => {
    ctrl.installMenu();
    expect(mocks.installAppMenu).toHaveBeenCalledWith(mocks.winObj);
    ctrl.showContextMenu(); // no-op
    expect(ctrl.createTray()).toBe(true);
    expect(mocks.createAppTray).toHaveBeenCalled();

    expect(await ctrl.confirmSomething("sure?")).toBe(true);
    expect(mocks.confirmDialog).toHaveBeenCalledWith("sure?");
    await ctrl.alertSomething("hi");
    expect(mocks.alertDialog).toHaveBeenCalledWith("hi");
  });

  it("quit quits the app", () => {
    ctrl.quit();
    expect(mocks.quit).toHaveBeenCalled();
  });
});
