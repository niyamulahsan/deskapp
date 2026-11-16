import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, handlers, placeholder } from "@/modules/app/controllers/net.controller";

describe("app net.controller", () => {
  const origFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("exposes handlers", () => {
    expect(handlers.fetchJson).toBe(fetchJson);
    expect(handlers.placeholder).toBe(placeholder);
  });

  it("rejects invalid urls", async () => {
    expect(await fetchJson("")).toMatchObject({ ok: false });
    expect(await fetchJson("ftp://x")).toMatchObject({ ok: false });
    expect(await fetchJson(undefined)).toMatchObject({ ok: false });
  });

  it("fetchJson returns parsed json on success", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ a: 1 }),
      text: async () => '{"a":1}',
    })) as any;
    const res = await fetchJson("https://example.com/api");
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ a: 1 });
  });

  it("fetchJson handles non-ok and fetch errors", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/plain" }),
      text: async () => "boom",
    })) as any;
    expect(await fetchJson("https://example.com/x")).toMatchObject({ ok: false, status: 500 });

    globalThis.fetch = vi.fn(async () => {
      throw new Error("network");
    }) as any;
    expect(await fetchJson("https://example.com/x")).toMatchObject({ ok: false, error: expect.stringContaining("network") });
  });

  it("placeholder proxies the jsonplaceholder endpoint", async () => {
    globalThis.fetch = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ title: "x", url }),
      text: async () => "{}",
    })) as any;
    const res = await placeholder();
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
