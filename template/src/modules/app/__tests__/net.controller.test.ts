// ./src/modules/app/__tests__/net.controller.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBase, apiBaseUrl, apiFetch, fetchJson, handlers, http, placeholder } from "@/modules/app/controllers/net.controller";

describe("app net.controller", () => {
  const origFetch = globalThis.fetch;
  const origApiUrl = process.env.API_URL;
  const origViteApiUrl = process.env.VITE_API_URL;

  afterEach(() => {
    globalThis.fetch = origFetch;
    if (origApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = origApiUrl;
    if (origViteApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = origViteApiUrl;
    vi.restoreAllMocks();
  });

  it("exposes handlers", () => {
    expect(handlers.apiBase).toBe(apiBase);
    expect(handlers.apiFetch).toBe(apiFetch);
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

  describe("apiBase / apiFetch", () => {
    it("apiBase reports the configured base URL and strips trailing slashes", async () => {
      process.env.API_URL = "http://localhost:3000/";
      expect(apiBaseUrl()).toBe("http://localhost:3000");
      expect(await apiBase()).toMatchObject({ ok: true, url: "http://localhost:3000", configured: true });
    });

    it("apiBase is unconfigured when API_URL is empty", async () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      expect(await apiBase()).toMatchObject({ ok: true, url: "", configured: false });
    });

    it("apiFetch is offline when no base URL is configured", async () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      const spy = vi.spyOn(http, "request");
      expect(await apiFetch("/api/health")).toMatchObject({ ok: false, offline: true });
      expect(spy).not.toHaveBeenCalled();
    });

    it("apiFetch joins the base URL and path, and returns the parsed body", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http, "request").mockResolvedValue({ status: 200, data: { data: { balance: 10 } } } as any);

      const res = await apiFetch("api/wallet/balance");
      expect(res).toMatchObject({ ok: true, status: 200, url: "http://localhost:3000/api/wallet/balance" });
      expect(res.data).toEqual({ data: { balance: 10 } });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "http://localhost:3000/api/wallet/balance", method: "GET" }));
    });

    it("apiFetch passes a JSON body and an Authorization header", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http, "request").mockResolvedValue({ status: 200, data: {} } as any);

      await apiFetch("/api/auth/login", {
        method: "post",
        body: { email: "a@b.c", password: "x" },
        token: "jwt-token"
      });

      const arg = spy.mock.calls[0][0] as any;
      expect(arg.method).toBe("POST");
      expect(arg.data).toEqual({ email: "a@b.c", password: "x" });
      expect(arg.headers.Authorization).toBe("Bearer jwt-token");
    });

    it("apiFetch marks non-ok responses (HTTP errors resolve, not throw)", async () => {
      process.env.API_URL = "http://localhost:3000";
      vi.spyOn(http, "request").mockResolvedValue({ status: 401, data: { message: "Unauthorized" } } as any);
      expect(await apiFetch("/api/auth/me")).toMatchObject({ ok: false, status: 401 });
    });

    it("apiFetch marks network failures as offline", async () => {
      process.env.API_URL = "http://localhost:3000";
      vi.spyOn(http, "request").mockRejectedValue(new Error("network"));
      expect(await apiFetch("/api/auth/me")).toMatchObject({ ok: false, offline: true, error: expect.stringContaining("network") });
    });

    it("apiFetch allows an absolute http(s) URL without a base", async () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      const spy = vi.spyOn(http, "request").mockResolvedValue({ status: 200, data: {} } as any);
      await apiFetch("https://example.com/health");
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/health" }));
    });
  });
});
