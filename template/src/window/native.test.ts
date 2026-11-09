import { describe, expect, it, vi } from "vitest";

const trayInstance = { setToolTip: vi.fn(), setContextMenu: vi.fn() };
vi.mock("electron", () => {
  const Tray = vi.fn(function () { return trayInstance; });
  const Menu = { buildFromTemplate: vi.fn((t) => t), setApplicationMenu: vi.fn() };
  const nativeImage = { createFromPath: vi.fn(() => ({ isEmpty: () => false })) };
  const dialog = {
    showMessageBox: vi.fn(async () => ({ response: 1 })),
  };
  return { Tray, Menu, nativeImage, dialog, app: { getAppPath: () => "/app", quit: vi.fn(), dock: { hide: vi.fn() } } };
});
vi.mock("@/core/config", () => ({ config: { appName: "Deskapp" } }));
vi.mock("@/window/manager", () => ({
  win: { getWindow: () => undefined, openWindow: vi.fn() },
}));

import { dialog } from "electron";
import { chrome } from "@/window/native";

describe("window/native chrome", () => {
  it("parses/default menu helpers and tray availability", () => {
    expect(chrome.isTrayAvailable()).toBe(true);
    const items = chrome.defaultMenuItems();
    expect(items.length).toBeGreaterThan(0);
  });

  it("confirm/alert dialogs delegate to electron", async () => {
    expect(await chrome.confirmDialog("sure?")).toBe(true);
    (dialog.showMessageBox as any).mockResolvedValueOnce({ response: 0 });
    expect(await chrome.confirmDialog("no")).toBe(false);
    await chrome.alertDialog("hi");
    expect(dialog.showMessageBox).toHaveBeenCalled();
  });

  it("promptDialog is a stub returning null", async () => {
    expect(await chrome.promptDialog("name")).toBeNull();
  });

  it("createTray/createAppTray/createHeadlessTray use Tray", () => {
    expect(chrome.createTray()).toBeTruthy();
    expect(chrome.createAppTray()).toBeTruthy();
    expect(chrome.createHeadlessTray()).toBeTruthy();
  });
});
