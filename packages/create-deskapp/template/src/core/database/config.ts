/**
 * config.ts (core/database) - database path resolution (SQLite only).
 *
 * The app always runs on a local SQLite database. The only knob is the
 * `DATABASE_URL` env var (set in `.env`):
 *   sqlite:./path.db -> SQLite (default)
 */

/** The path to the local SQLite file. */
export function resolveDatabaseUrl(): string {
  return Deno.env.get("DATABASE_URL") || "sqlite:./src/storage/deskapp.sqlite";
}

/** The local SQLite file path (strips the `sqlite:` scheme). */
export function sqliteFile(): string {
  return resolveDatabaseUrl().replace(/^sqlite:/, "");
}
