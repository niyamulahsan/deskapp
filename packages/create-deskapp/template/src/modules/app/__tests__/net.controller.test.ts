// ./src/modules/app/__tests__/net.controller.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";

// The controller delegates server calls to the facade `http` helper; mock it so
// this test covers the binding surface only (the helper has its own test).
vi.mock("@/core/facade", () => ({
  http: { baseUrl: vi.fn(() => ""), request: vi.fn() }
}));

import { http } from "@/core/facade";
import { apiBase, apiFetch, fetchJson, handlers, placeholder } from "@/modules/app/controllers/net.controller";

describe("app net.controller", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.clearAllMocks();
  });

  it("exposes handlers", () => {
    expect(handlers.apiBase).toBe(apiBase);
    expect(handlers.apiFetch).toBe(apiFetch);
    expect(handlers.fetchJson).toBe(fetchJson);
    expect(handlers.placeholder).toBe(placeholder);
  });

  describe("apiBase", () => {
    it("reports the configured base URL", async () => {
      vi.mocked(http.baseUrl).mockReturnValue("http://localhost:3000");
      expect(await apiBase()).toMatchObject({ ok: true, url: "http://localhost:3000", configured: true });
    });

    it("is unconfigured when API_URL is empty", async () => {
      vi.mocked(http.baseUrl).mockReturnValue("");
      expect(await apiBase()).toMatchObject({ ok: true, url: "", configured: false });
    });
  });

  describe("apiFetch", () => {
    it("delegates to the facade http.request", async () => {
      vi.mocked(http.request).mockResolvedValue({ ok: true, status: 200, url: "http://localhost:3000/api/x", data: { a: 1 } });
      const res = await apiFetch("/api/x", { token: "t" });
      expect(res).toMatchObject({ ok: true, status: 200, data: { a: 1 } });
      expect(http.request).toHaveBeenCalledWith("/api/x", { token: "t" });
    });
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
      text: async () => '{"a":1}'
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
      text: async () => "boom"
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
      text: async () => "{}"
    })) as any;
    const res = await placeholder();
    expect(res.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
