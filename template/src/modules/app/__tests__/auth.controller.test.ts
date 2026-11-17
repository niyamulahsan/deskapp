// ./src/modules/app/__tests__/auth.controller.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The controller is the thin `app.auth.*` binding surface. It delegates the
 * client (endpoints, session keys, interceptors) to `@config/auth`, so both the
 * facade `http` helper and the facade `session` store are mocked here —
 * `session` with a tiny in-memory map, `http` with spies and a fake axios client
 * (the real config installs its interceptors on it). The real `validate` is kept
 * so the login schema is exercised for real.
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

  const client = {
    interceptors: {
      request: { use: () => 0 },
      response: { use: () => 0 }
    },
    request: vi.fn()
  };

  const post = vi.fn();
  const get = vi.fn();

  return { map, session, client, post, get };
});

vi.mock("@/core/facade", async () => {
  const { validate } = await vi.importActual<typeof import("@/core/utils/validation")>("@/core/utils/validation");
  return {
    http: { post: mocks.post, get: mocks.get, client: mocks.client },
    session: mocks.session,
    validate
  };
});

import { session } from "@/core/facade";
import * as auth from "@/modules/app/controllers/auth.controller";

const tokenBody = (over: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  data: { data: { access_token: "a1", refresh_token: "r1", user: { id: 1 }, ...over } }
});

describe("app auth.controller", () => {
  beforeEach(() => {
    session.flush();
    mocks.post.mockReset();
    mocks.get.mockReset();
  });

  it("exposes handlers", () => {
    expect(auth.handlers.login).toBe(auth.login);
    expect(auth.handlers.me).toBe(auth.me);
    expect(auth.handlers.logout).toBe(auth.logout);
    expect(auth.handlers.status).toBe(auth.status);
  });

  describe("login", () => {
    it("validates the body before calling the server", async () => {
      await expect(auth.login({ email: "", password: "" })).rejects.toMatchObject({ status: 422 });
      expect(mocks.post).not.toHaveBeenCalled();
    });

    it("stores the token pair and returns the user, never the tokens", async () => {
      mocks.post.mockResolvedValue(tokenBody());
      const res = await auth.login({ email: "a@b.c", password: "x" });

      expect(res).toEqual({ ok: true, status: 200, user: { id: 1 } });
      expect(session.get(session.DEFAULT, "accessToken")).toBe("a1");
      expect(session.get(session.DEFAULT, "refreshToken")).toBe("r1");
      expect(mocks.post).toHaveBeenCalledWith("/api/auth/login", { body: { email: "a@b.c", password: "x" } });
    });

    it("reports a rejected login without storing tokens", async () => {
      mocks.post.mockResolvedValue({ ok: false, status: 401, data: { message: "Invalid credentials" } });
      const res = await auth.login({ email: "a@b.c", password: "bad" });

      expect(res).toMatchObject({ ok: false, status: 401, user: null, error: "Invalid credentials" });
      expect(session.get(session.DEFAULT, "accessToken")).toBeNull();
    });

    it("reports an offline server", async () => {
      mocks.post.mockResolvedValue({ ok: false, status: 0, offline: true, error: "connect ECONNREFUSED" });
      expect(await auth.login({ email: "a@b.c", password: "x" })).toMatchObject({ ok: false, offline: true });
    });
  });

  describe("me", () => {
    it("returns 401 with no token and makes no call", async () => {
      expect(await auth.me()).toMatchObject({ ok: false, status: 401, user: null });
      expect(mocks.get).not.toHaveBeenCalled();
    });

    it("returns and caches the user", async () => {
      session.merge(session.DEFAULT, { accessToken: "a1" });
      mocks.get.mockResolvedValue({ ok: true, status: 200, data: { data: { id: 1 } } });

      expect(await auth.me()).toMatchObject({ ok: true, user: { id: 1 } });
      expect(session.get(session.DEFAULT, "user")).toEqual({ id: 1 });
    });

    it("clears the session on a 401", async () => {
      session.merge(session.DEFAULT, { accessToken: "a1", refreshToken: "r1" });
      mocks.get.mockResolvedValue({ ok: false, status: 401, data: {} });

      expect(await auth.me()).toMatchObject({ ok: false, status: 401, user: null });
      expect(session.get(session.DEFAULT, "accessToken")).toBeNull();
    });
  });

  describe("status", () => {
    it("reflects the local session with no network call", () => {
      expect(auth.status()).toEqual({ authenticated: false, user: null });
      session.merge(session.DEFAULT, { accessToken: "a1", user: { id: 1 } });
      expect(auth.status()).toEqual({ authenticated: true, user: { id: 1 } });
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("clears the session and best-effort notifies the server", async () => {
      session.merge(session.DEFAULT, { accessToken: "a1" });
      mocks.post.mockResolvedValue({ ok: true, status: 200, data: {} });

      expect(await auth.logout()).toEqual({ ok: true });
      expect(session.get(session.DEFAULT, "accessToken")).toBeNull();
      expect(mocks.post).toHaveBeenCalledWith("/api/auth/logout", { token: "a1" });
    });
  });
});
