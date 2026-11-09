import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const origBase = process.env.APP_BASE_DIR;

afterEach(() => {
  if (origBase === undefined) delete process.env.APP_BASE_DIR;
  else process.env.APP_BASE_DIR = origBase;
  vi.resetModules();
});

describe("env", () => {
  it("isDesktopRuntime returns a boolean", async () => {
    const env = await import("@/core/env");
    expect(typeof env.isDesktopRuntime()).toBe("boolean");
  });

  it("appBaseDir respects APP_BASE_DIR override", async () => {
    process.env.APP_BASE_DIR = path.resolve("custom-base-dir");
    const env = await import("@/core/env");
    expect(env.appBaseDir()).toBe(path.resolve("custom-base-dir"));
  });

  it("loadEnv is idempotent and envPath reflects state", async () => {
    process.env.APP_BASE_DIR = path.resolve("no-such-dir-for-env-test");
    const env = await import("@/core/env");
    const a = env.loadEnv();
    const b = env.loadEnv();
    expect(a).toBe(b);
    expect(env.envPath()).toBe(b);
  });
});
