/**
 * config.ts (core/database) - database path resolution (SQLite only).
 *
 * The app always runs on a local SQLite database. The only knob is the
 * `DATABASE_URL` env var (set in `.env`):
 *   sqlite:./path.db -> SQLite (default)
 *
 * Relative paths (dev defaults like `sqlite:./src/storage/...`) are anchored
 * to the runtime base directory (src/core/env.ts appBaseDir) so they resolve
 * against the project root in dev and next to the executable in a bundle,
 * never against an unpredictable Deno.cwd().
 */

import { isAbsolute, join } from "@std/path";
import { config } from "@/core/config.ts";
import { appBaseDir } from "@/core/env.ts";

/** The URI (scheme + path) for the local SQLite file. */
export function resolveDatabaseUrl(): string {
  const raw = (Deno.env.get("DATABASE_URL") ?? "").trim();
  if (!raw) {
    return `sqlite:${join(appBaseDir(), "src", "storage", `${config.appKebab}.sqlite`)}`;
  }
  // In-memory databases and remote libsql URLs are used as-is.
  if (raw.includes(":memory:")) return raw;
  if (raw.includes("://")) return raw;

  const body = raw.replace(/^(sqlite|file):/, "");
  const anchored = body && !isAbsolute(body)
    ? join(appBaseDir(), body)
    : body;
  return `${raw.startsWith("file:") ? "file" : "sqlite"}:${anchored}`;
}

/** The local SQLite file path (strips the `sqlite:`/`file:` scheme). */
export function sqliteFile(): string {
  return resolveDatabaseUrl().replace(/^(sqlite|file):/, "");
}