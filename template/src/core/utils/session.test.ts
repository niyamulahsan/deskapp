// ./src/core/utils/session.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "@/core/utils/session";

describe("core session", () => {
  beforeEach(() => {
    session.flush();
  });

  afterEach(() => {
    session.flush();
    vi.useRealTimers();
  });

  it("starts a session and returns its data", () => {
    const id = session.start({ user: "jane" });
    expect(typeof id).toBe("string");
    expect(session.all(id)).toEqual({ user: "jane" });
  });

  it("returns null for an unknown session", () => {
    expect(session.all("nope")).toBeNull();
    expect(session.get("nope", "user")).toBeNull();
  });

  it("sets and reads one key", () => {
    const id = session.start();
    session.set(id, "theme", "dark");
    expect(session.get(id, "theme")).toBe("dark");
    expect(session.all(id)).toEqual({ theme: "dark" });
  });

  it("creates the session on set when it does not exist", () => {
    expect(session.get("fresh", "a")).toBeNull();
    session.set("fresh", "a", 1);
    expect(session.get("fresh", "a")).toBe(1);
  });

  it("merges several keys at once", () => {
    const id = session.start({ a: 1 });
    session.merge(id, { b: 2, a: 9 });
    expect(session.all(id)).toEqual({ a: 9, b: 2 });
  });

  it("destroys one session and reports whether it existed", () => {
    const id = session.start({ a: 1 });
    expect(session.destroy(id)).toBe(true);
    expect(session.all(id)).toBeNull();
    expect(session.destroy(id)).toBe(false);
  });

  it("flushes every session", () => {
    const a = session.start({ a: 1 });
    const b = session.start({ b: 2 });
    session.flush();
    expect(session.all(a)).toBeNull();
    expect(session.all(b)).toBeNull();
  });

  it("expires a session once its TTL passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const id = session.start({ a: 1 }, { ttlMs: 1000 });
    expect(session.get(id, "a")).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(session.all(id)).toBeNull();
    expect(session.get(id, "a")).toBeNull();
  });

  it("never expires a session started with ttlMs 0 (the default)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const id = session.start({ a: 1 });
    vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 365);
    expect(session.get(id, "a")).toBe(1);
  });

  it("refresh extends the TTL and clears it with 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const id = session.start({ a: 1 }, { ttlMs: 1000 });
    vi.advanceTimersByTime(800);
    expect(session.refresh(id, 1000)).toBe(true);
    vi.advanceTimersByTime(800);
    expect(session.get(id, "a")).toBe(1);

    // A ttlMs of 0 clears the expiry entirely.
    expect(session.refresh(id, 0)).toBe(true);
    vi.advanceTimersByTime(1000 * 60 * 60 * 24 * 365);
    expect(session.get(id, "a")).toBe(1);

    expect(session.refresh("missing")).toBe(false);
  });

  it("is always available in memory", () => {
    expect(session.isAvailable()).toBe(true);
  });

  it("is memory-only without an Electron safeStorage backing", () => {
    expect(session.persistent()).toBe(false);
  });

  it("exposes a default session id", () => {
    expect(session.DEFAULT).toBe("default");
  });
});
