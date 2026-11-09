import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: false, getAppPath: () => "/tmp", getPath: () => "/tmp" } }));
vi.mock("@libsql/client", () => ({ createClient: () => ({}) }));
vi.mock("drizzle-orm/libsql", () => ({ drizzle: () => ({ $client: {} }) }));

describe("core facade exports", () => {
  it("re-exports key namespaces/functions", async () => {
    const mod = await import("@/core/facade");
    expect(mod.pass).toBeTruthy();
    expect(mod.validate).toBeTruthy();
    expect(mod.queue).toBeTruthy();
    expect(mod.cron).toBeTruthy();
    expect(mod.storage).toBeTruthy();
    expect(mod.files).toBeTruthy();
    expect(mod.paginate).toBeTruthy();
    expect(mod.win).toBeTruthy();
    expect(mod.chrome).toBeTruthy();
    expect(typeof mod.db.init).toBe("function");
  });
});
