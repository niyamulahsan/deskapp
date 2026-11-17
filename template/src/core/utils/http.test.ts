// ./src/core/utils/http.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";
import { baseUrl, http, resolveUrl } from "@/core/utils/http";

describe("core http", () => {
  const origApiUrl = process.env.API_URL;
  const origViteApiUrl = process.env.VITE_API_URL;

  afterEach(() => {
    if (origApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = origApiUrl;
    if (origViteApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = origViteApiUrl;
    vi.restoreAllMocks();
  });

  describe("baseUrl", () => {
    it("is empty when nothing is configured", () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      expect(baseUrl()).toBe("");
    });

    it("strips trailing slashes", () => {
      process.env.API_URL = "https://wallet.example.com/";
      expect(baseUrl()).toBe("https://wallet.example.com");
    });

    it("fills in http for a local host and https otherwise", () => {
      process.env.API_URL = "localhost:3000";
      expect(baseUrl()).toBe("http://localhost:3000");
      process.env.API_URL = "127.0.0.1:8080";
      expect(baseUrl()).toBe("http://127.0.0.1:8080");
      process.env.API_URL = "wallet.example.com";
      expect(baseUrl()).toBe("https://wallet.example.com");
    });

    it("keeps an explicit scheme", () => {
      process.env.API_URL = "https://api.example.com";
      expect(baseUrl()).toBe("https://api.example.com");
    });
  });

  describe("resolveUrl", () => {
    it("passes an absolute url through, with or without a base", () => {
      delete process.env.API_URL;
      expect(resolveUrl("http://example.com/x")).toBe("http://example.com/x");
      process.env.API_URL = "http://localhost:3000";
      expect(resolveUrl("https://example.com/x")).toBe("https://example.com/x");
    });

    it("joins a relative path to the base", () => {
      process.env.API_URL = "http://localhost:3000";
      expect(resolveUrl("/api/x")).toBe("http://localhost:3000/api/x");
      expect(resolveUrl("api/x")).toBe("http://localhost:3000/api/x");
    });

    it("is empty for a relative path with no base", () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      expect(resolveUrl("/api/x")).toBe("");
    });
  });

  describe("request", () => {
    it("requires a path", async () => {
      expect(await http.request("")).toMatchObject({ ok: false, error: "path is required" });
    });

    it("is offline when no base is configured and the path is relative", async () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      const spy = vi.spyOn(http.client, "request");
      expect(await http.request("/api/health")).toMatchObject({ ok: false, offline: true });
      expect(spy).not.toHaveBeenCalled();
    });

    it("joins the base and path and returns the parsed body", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: { data: { balance: 10 } } } as any);

      const res = await http.request("api/wallet/balance");
      expect(res).toMatchObject({ ok: true, status: 200, url: "http://localhost:3000/api/wallet/balance" });
      expect(res.data).toEqual({ data: { balance: 10 } });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "http://localhost:3000/api/wallet/balance", method: "GET" }));
    });

    it("JSON-encodes the body and sets the bearer header", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: {} } as any);

      await http.post("/api/auth/login", { body: { email: "a@b.c", password: "x" }, token: "jwt" });

      const arg = spy.mock.calls[0][0] as any;
      expect(arg.method).toBe("POST");
      expect(arg.data).toEqual({ email: "a@b.c", password: "x" });
      expect(arg.headers.Authorization).toBe("Bearer jwt");
    });

    it("does not overwrite an explicit Authorization header", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: {} } as any);
      await http.get("/api/me", { token: "ignored", headers: { Authorization: "Basic abc" } });
      const arg = spy.mock.calls[0][0] as any;
      expect(arg.headers.Authorization).toBe("Basic abc");
    });

    it("marks non-2xx responses not-ok (HTTP errors resolve, not throw)", async () => {
      process.env.API_URL = "http://localhost:3000";
      vi.spyOn(http.client, "request").mockResolvedValue({ status: 401, data: { message: "Unauthorized" } } as any);
      expect(await http.get("/api/auth/me")).toMatchObject({ ok: false, status: 401 });
    });

    it("marks a network failure as offline", async () => {
      process.env.API_URL = "http://localhost:3000";
      vi.spyOn(http.client, "request").mockRejectedValue(new Error("network"));
      expect(await http.get("/api/auth/me")).toMatchObject({ ok: false, offline: true, error: expect.stringContaining("network") });
    });

    it("allows an absolute url without a base", async () => {
      delete process.env.API_URL;
      delete process.env.VITE_API_URL;
      const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: {} } as any);
      await http.get("https://example.com/health");
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/health" }));
    });
  });

  describe("verbs", () => {
    it("set the right HTTP method", async () => {
      process.env.API_URL = "http://localhost:3000";
      const spy = vi.spyOn(http.client, "request").mockResolvedValue({ status: 200, data: {} } as any);
      await http.get("/a");
      await http.post("/a");
      await http.put("/a");
      await http.patch("/a");
      await http.delete("/a");
      expect(spy.mock.calls.map((c) => (c[0] as any).method)).toEqual(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    });
  });

  it("exposes the raw axios client", () => {
    expect(typeof http.client.request).toBe("function");
    expect(http.client).toBeTruthy();
  });
});
