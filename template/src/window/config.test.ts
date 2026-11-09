import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/config", () => ({
  config: { appName: "TestApp", appKebab: "testapp", ui: { enabled: true } },
}));

describe("window/config", () => {
  it("defines a main window preset with required fields", async () => {
    const mod = await import("@/window/config");
    expect(mod.windowConfig.title).toBe("TestApp");
    expect(mod.windowConfig.width).toBeGreaterThan(0);
    expect(mod.windowConfig.height).toBeGreaterThan(0);
    expect(mod.windows.main).toBe(mod.windowConfig);
  });
});
