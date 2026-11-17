// ./src/core/utils/session.ts

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * session - a small key/value session store for the main process.
 *
 * Import it from the facade, never from here:
 *
 *   import { session } from "@/core/facade";
 *
 *   const id = session.start({ user: "jane" });
 *   session.set(id, "theme", "dark");
 *   session.get(id, "theme");           // "dark"
 *   session.all<{ user: string }>(id);  // { user: "jane", theme: "dark" }
 *
 * One session per id, each a plain JSON object with an optional TTL. It is the
 * deskapp counterpart of nexwire's framework `session`: a keyed store any module
 * can reach for per-user state — an auth token, a wizard step, a small cache.
 * `session.DEFAULT` is the app's own session (one per app instance).
 *
 * - **In-memory first.** Reads and writes are synchronous and never throw.
 * - **Encrypted at rest when possible.** When Electron's `safeStorage` is
 *   available the store is written to `<userData>/session.enc` (ciphertext) and
 *   restored on the next launch; in a plain Node/dev/test process it is memory
 *   only, so `session.persistent()` reports `false` and nothing touches disk.
 * - **Values must be JSON-serialisable** — that is what persistence stores.
 */

export type SessionData = Record<string, unknown>;

type Entry = { data: SessionData; expiresAt: number };

/** Default lifetime for a session started without `ttlMs` (0 = never expires). */
const DEFAULT_TTL_MS = 0;

type SafeStorage = {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
};

/** Resolve Electron's `safeStorage` + `userData` dir, or undefined in plain Node. */
function electron(): { safeStorage?: SafeStorage; userData?: string } | undefined {
  try {
    const req = typeof require !== "undefined" ? require : createRequire(`${process.cwd()}/`);
    const e = req("electron") as { safeStorage?: SafeStorage; app?: { getPath?: (name: string) => string } };
    if (!e || typeof e !== "object") return undefined;
    return { safeStorage: e.safeStorage, userData: e.app?.getPath?.("userData") };
  } catch {
    return undefined;
  }
}

const store = new Map<string, Entry>();
let restored = false;

/** `<userData>/session.enc`, or null when there is no writable app dir. */
function filePath(): string | null {
  const userData = electron()?.userData;
  return userData ? join(userData, "session.enc") : null;
}

/** True only when an encrypted, writable backing store is available. */
function canPersist(): boolean {
  const e = electron();
  return Boolean(e?.userData && e.safeStorage?.isEncryptionAvailable?.());
}

/** Load the encrypted store once, dropping any expired entries. */
function restore(): void {
  if (restored) return;
  restored = true;

  const file = filePath();
  const e = electron();
  if (!file || !e?.safeStorage || !canPersist()) return;

  try {
    const plain = e.safeStorage.decryptString(fs.readFileSync(file));
    const parsed = JSON.parse(plain) as Record<string, Entry>;
    const now = Date.now();
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== "object") continue;
      if (entry.expiresAt && entry.expiresAt <= now) continue;
      store.set(id, { data: entry.data ?? {}, expiresAt: entry.expiresAt ?? 0 });
    }
  } catch {
    // Missing, corrupt, or undecryptable — start clean.
  }
}

/** Write the whole store back as ciphertext. Best-effort: never throws. */
function persist(): void {
  if (!canPersist()) return;
  const file = filePath();
  const e = electron();
  if (!file || !e?.safeStorage) return;

  try {
    const encrypted = e.safeStorage.encryptString(JSON.stringify(Object.fromEntries(store)));
    fs.mkdirSync(dirname(file), { recursive: true });
    fs.writeFileSync(file, encrypted);
  } catch {
    // Persistence is a convenience; a failure must not break the write.
  }
}

/** The live entry for an id, purging it when its TTL has passed. */
function live(id: string): Entry | null {
  restore();
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(id);
    persist();
    return null;
  }
  return entry;
}

export const session = {
  /** The app's own session id (one session per app instance). */
  DEFAULT: "default",

  /** Create a session and return its id. `ttlMs` 0 (the default) never expires. */
  start(data: SessionData = {}, opts: { ttlMs?: number } = {}): string {
    restore();
    const id = randomUUID();
    const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
    store.set(id, { data: { ...data }, expiresAt: ttl > 0 ? Date.now() + ttl : 0 });
    persist();
    return id;
  },

  /** The whole session object, or null when it is missing or expired. */
  all<T = SessionData>(id: string): T | null {
    const entry = live(id);
    return entry ? (entry.data as T) : null;
  },

  /** One key of a session, or null. */
  get<T = unknown>(id: string, key: string): T | null {
    const entry = live(id);
    if (!entry) return null;
    return (entry.data[key] as T) ?? null;
  },

  /** Write one key, creating the session when it does not exist. */
  set(id: string, key: string, value: unknown): boolean {
    const entry = live(id) ?? { data: {}, expiresAt: 0 };
    entry.data[key] = value;
    store.set(id, entry);
    persist();
    return true;
  },

  /** Merge several keys at once, creating the session when it does not exist. */
  merge(id: string, data: SessionData): boolean {
    const entry = live(id) ?? { data: {}, expiresAt: 0 };
    entry.data = { ...entry.data, ...data };
    store.set(id, entry);
    persist();
    return true;
  },

  /** Extend the TTL (`ttlMs` 0 clears it). False when the session is gone. */
  refresh(id: string, ttlMs?: number): boolean {
    const entry = live(id);
    if (!entry) return false;
    const ttl = ttlMs ?? DEFAULT_TTL_MS;
    entry.expiresAt = ttl > 0 ? Date.now() + ttl : 0;
    persist();
    return true;
  },

  /** Delete one session. True when it existed. */
  destroy(id: string): boolean {
    restore();
    const existed = store.delete(id);
    if (existed) persist();
    return existed;
  },

  /** Delete every session. */
  flush(): boolean {
    restore();
    store.clear();
    persist();
    return true;
  },

  /** The store is always usable in-memory, so this is always true. */
  isAvailable(): boolean {
    return true;
  },

  /** True when sessions are encrypted and restored across launches. */
  persistent(): boolean {
    return canPersist();
  }
};

export type SessionFacade = typeof session;
