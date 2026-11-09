import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "C:/exe" },
}));

import { existsPath, platformRelPaths } from "@/core/utils/playwright";

describe("playwright utils", () => {
  it("platformRelPaths returns paths for the current platform", () => {
    const rel = platformRelPaths();
    expect(Array.isArray(rel)).toBe(true);
    if (process.platform === "win32") {
      expect(rel.some((p) => p.includes("chrome.exe"))).toBe(true);
    }
  });

  it("existsPath returns false for missing paths", () => {
    expect(existsPath("Z:/definitely/not/a/real/path/deskapp-test")).toBe(false);
  });
});
