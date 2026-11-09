import { describe, expect, it, vi } from "vitest";

const page = { goto: vi.fn(async () => undefined), title: vi.fn(async () => "Example") };
const browser = { newPage: vi.fn(async () => page), pages: vi.fn(async () => [page]), close: vi.fn(async () => undefined) };
const chromium = {
  executablePath: () => "C:/chrome.exe",
  launch: vi.fn(async () => browser),
  launchPersistentContext: vi.fn(async () => browser),
};

vi.mock("playwright", () => ({ chromium }));
vi.mock("@/core/facade", () => ({
  chromium: {
    resolve: () => undefined,
    extensions: () => [],
    exists: () => false,
  },
}));
vi.mock("@/core/utils/playwright", () => ({
  ensurePlaywrightBrowser: vi.fn(async () => undefined),
  existsPath: () => true,
}));
vi.mock("node:fs/promises", () => ({ mkdtemp: vi.fn(async () => "/tmp/pw") }));

import { handlers, play } from "@/modules/app/controllers/playwright.controller";

describe("app playwright.controller", () => {
  it("exposes handlers", () => {
    expect(handlers.play).toBe(play);
  });

  it("launches chromium and returns page info", async () => {
    const res = await play({ url: "https://example.com", seconds: 1, headless: true });
    expect(res.ok).toBe(true);
    expect(res.title).toBe("Example");
    expect(res.chromium).toBe("playwright-registry");
    expect(browser.close).toHaveBeenCalled();
  });

  it("returns error when playwright is unavailable", async () => {
    // Re-mocking dynamic import failure is tricky in same module context; verify
    // the handler shape at minimum and that errors are caught in normal flow.
    chromium.launch.mockRejectedValueOnce(new Error("launch failed"));
    const res = await play({ seconds: 1 });
    expect(res.ok).toBe(false);
    expect(String(res.error)).toContain("launch failed");
  });
});
