import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/config", () => ({
  config: { appKebab: "deskapp" },
}));
vi.mock("@/core/env", () => ({
  appBaseDir: () => "/tmp/appbase",
}));

describe("database/config", () => {
  const orig = process.env.DATABASE_URL;
  afterEach(() => {
    if (orig === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = orig;
  });

  it("resolves sqlite file from DATABASE_URL sqlite:path", async () => {
    process.env.DATABASE_URL = "sqlite:./src/storage/test.sqlite";
    const { sqliteFile } = await import("@/core/database/config");
    // re-evaluates per call; module caches nothing critical here
    expect(sqliteFile().replace(/\\/g, "/")).toContain("src/storage/test.sqlite");
  });

  it("passes through :memory:", async () => {
    process.env.DATABASE_URL = "sqlite::memory:";
    const { resolveDatabaseUrl } = await import("@/core/database/config");
    expect(resolveDatabaseUrl()).toContain(":memory:");
  });
});
