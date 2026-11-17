// ./src/config/auth.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The auth client lives in `@config/auth`. It talks to the facade `http` helper
 * and keeps the token pair in the facade `session` store, so both are mocked
 * here — `session` with a tiny in-memory map, `http` with spies and a fake axios
 * client whose interceptors we can invoke by hand.
 */
const mocks = vi.hoisted(() => {
  const map = new Map<string, Record<string, unknown>>();

  const session = {
    DEFAULT: "default",
    start: (data: Record<string, unknown> = {}) => {
      const id = `s${map.size}`;
      map.set(id, { ...data });
      return id;
    },
    all: (id: string) => map.get(id) ?? null,
    get: (id: string, key: string) => (map.get(id)?.[key] ?? null) as unknown,
    set: (id: string, key: string, value: unknown) => {
      const entry = map.get(id) ?? {};
      entry[key] = value;
      map.set(id, entry);
      return true;
    },
    merge: (id: string, data: Record<string, unknown>) => {
      map.set(id, { ...(map.get(id) ?? {}), ...data });
      return true;
    },
    refresh: () => true,
    destroy: (id: string) => map.delete(id),
    flush: () => {
      map.clear();
      return true;
    },
    isAvailable: () => true,
    persistent: () => false
  };

  const requestHandlers: Array<(config: any) => any> = [];
  const responseHandlers: Array<(response: any) => any> = [];
  const clientRequest = vi.fn();

  const client = {
    interceptors: {
      request: {
        use: (fn: (config: any) => any) => {
          requestHandlers.push(fn);
          return requestHandlers.length - 1;
        }
      },
      response: {
        use: (fn: (response: any) => any) => {
          responseHandlers.push(fn);
          return responseHandlers.length - 1;
        }
      }
    },
    request: clientRequest
  };

  const post = vi.fn();
  const get = vi.fn();

  return { map, session, client, post, get, clientRequest, requestHandlers, responseHandlers };
});

vi.mock("@/core/facade", () => ({
  http: { post: mocks.post, get: mocks.get, client: mocks.client },
  session: mocks.session
}));

import { AUTH, accessToken, clearSession, currentUser, install, refreshTokens, saveUser, storeTokens } from "@config/auth";
import { session } from "@/core/facade";

const requestInterceptor = () => mocks.requestHandlers[0];
const responseInterceptor = () => mocks.responseHandlers[0];

describe("config auth", () => {
  beforeEach(() => {
    session.flush();
    mocks.post.mockReset();
    mocks.get.mockReset();
    mocks.clientRequest.mockReset();
  });

  it("installs the bearer + refresh interceptors on load, once", () => {
    expect(mocks.requestHandlers).toHaveLength(1);
    expect(mocks.responseHandlers).toHaveLength(1);
    install();
    expect(mocks.requestHandlers).toHaveLength(1);
    expect(mocks.responseHandlers).toHaveLength(1);
  });

  describe("contract", () => {
    it("reads the token pair + user out of a nexwire payload", () => {
      expect(AUTH.readTokens({ access_token: "a", refresh_token: "r", user: { id: 1 } })).toEqual({
        access: "a",
        refresh: "r",
        user: { id: 1 }
      });
    });

    it("returns nulls for a payload that does not match the contract", () => {
      expect(AUTH.readTokens({ token: "a" })).toEqual({ access: null, refresh: null, user: null });
      expect(AUTH.readTokens(undefined)).toEqual({ access: null, refresh: null, user: null });
    });
  });

  describe("session helpers", () => {
    it("stores the token pair + user and reads them back", () => {
      storeTokens({ access_token: "a1", refresh_token: "r1", user: { id: 1 } });
      expect(accessToken()).toBe("a1");
      expect(currentUser()).toEqual({ id: 1 });
      expect(session.get(session.DEFAULT, "refreshToken")).toBe("r1");
    });

    it("caches a user and clears the session", () => {
      saveUser({ id: 2 });
      expect(currentUser()).toEqual({ id: 2 });
      clearSession();
      expect(accessToken()).toBeNull();
      expect(currentUser()).toBeNull();
    });
  });

  describe("request interceptor", () => {
    it("attaches the stored access token", () => {
      session.merge(session.DEFAULT, { accessToken: "abc" });
      const config: any = { headers: {} };
      requestInterceptor()(config);
      expect(config.headers.Authorization).toBe("Bearer abc");
    });

    it("attaches nothing without a token", () => {
      const config: any = { headers: {} };
      requestInterceptor()(config);
      expect(config.headers.Authorization).toBeUndefined();
    });

    it("does not overwrite an explicit Authorization header", () => {
      session.merge(session.DEFAULT, { accessToken: "abc" });
      const config: any = { headers: { Authorization: "Basic x" } };
      requestInterceptor()(config);
      expect(config.headers.Authorization).toBe("Basic x");
    });

    it("replaces its own stale header on a retry", () => {
      session.merge(session.DEFAULT, { accessToken: "new" });
      const config: any = { headers: { Authorization: "Bearer old" }, __deskappRetried: true };
      requestInterceptor()(config);
      expect(config.headers.Authorization).toBe("Bearer new");
    });
  });

  describe("refreshTokens", () => {
    it("does nothing without a refresh token", async () => {
      expect(await refreshTokens()).toBe(false);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it("rotates the pair once and de-dupes concurrent callers", async () => {
      session.merge(session.DEFAULT, { refreshToken: "r1" });
      let release: (value: unknown) => void = () => {};
      mocks.post.mockImplementation(() => new Promise((resolve) => (release = resolve)));

      const a = refreshTokens();
      const b = refreshTokens();
      release({ ok: true, status: 200, data: { data: { access_token: "a2", refresh_token: "r2" } } });
      await Promise.all([a, b]);

      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.post).toHaveBeenCalledWith("/api/auth/refresh-token", { body: { refresh_token: "r1" } });
      expect(accessToken()).toBe("a2");
      expect(session.get(session.DEFAULT, "refreshToken")).toBe("r2");
    });

    it("signs out when the refresh fails", async () => {
      session.merge(session.DEFAULT, { accessToken: "a1", refreshToken: "r1" });
      mocks.post.mockResolvedValue({ ok: false, status: 401, data: { message: "revoked" } });

      expect(await refreshTokens()).toBe(false);
      expect(accessToken()).toBeNull();
    });
  });

  describe("response interceptor", () => {
    it("passes a non-401 response through untouched", async () => {
      const res: any = { status: 200, config: {} };
      expect(await responseInterceptor()(res)).toBe(res);
    });

    it("does not refresh on a login 401 (bad credentials, not a stale token)", async () => {
      const res: any = { status: 401, config: { url: "/api/auth/login" } };
      expect(await responseInterceptor()(res)).toBe(res);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it("does not refresh when there is no refresh token", async () => {
      const res: any = { status: 401, config: { url: "/api/auth/me", headers: {} } };
      expect(await responseInterceptor()(res)).toBe(res);
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it("refreshes once, stores the rotated pair and retries", async () => {
      session.merge(session.DEFAULT, { refreshToken: "r1" });
      mocks.post.mockResolvedValue({ ok: true, status: 200, data: { data: { access_token: "a2", refresh_token: "r2" } } });
      const retried: any = { status: 200 };
      mocks.clientRequest.mockResolvedValue(retried);

      const config: any = { url: "/api/auth/me", headers: {} };
      const out = await responseInterceptor()({ status: 401, config });

      expect(mocks.post).toHaveBeenCalledWith("/api/auth/refresh-token", { body: { refresh_token: "r1" } });
      expect(accessToken()).toBe("a2");
      expect(config.__deskappRetried).toBe(true);
      expect(mocks.clientRequest).toHaveBeenCalledWith(config);
      expect(out).toBe(retried);
    });

    it("signs out when the refresh fails", async () => {
      session.merge(session.DEFAULT, { accessToken: "a1", refreshToken: "r1" });
      mocks.post.mockResolvedValue({ ok: false, status: 401, data: { message: "revoked" } });

      const res: any = { status: 401, config: { url: "/api/auth/me", headers: {} } };
      expect(await responseInterceptor()(res)).toBe(res);
      expect(accessToken()).toBeNull();
    });
  });
});
