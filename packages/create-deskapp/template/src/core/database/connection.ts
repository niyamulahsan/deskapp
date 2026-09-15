/**
 * connection.ts - opens and holds a single Drizzle connection to SQLite.
 *
 * 1. Reads the database path from core/database/config.ts.
 * 2. Creates the folder if it does not exist.
 * 3. Connects with the right driver:
 *    - In the desktop runtime we use node:sqlite (no native addon).
 *    - Otherwise we use the @libsql/client driver.
 * 4. Returns a singleton so we only ever open one connection.
 */

import type { Client as LibSqlClient } from "@libsql/client";
import type { DatabaseSync } from "node:sqlite";
import * as schema from "@/database/schema.ts";
import { sqliteFile } from "@/core/database/config.ts";
import { isDesktopRuntime } from "@/core/env.ts";

let databaseInstance: DrizzleDatabase | null = null;
let databaseClient: LibSqlClient | DatabaseSync | null = null;

/** The Drizzle database object created by either driver, aware of the schema. */
export type DrizzleDatabase = import("drizzle-orm/libsql").LibSQLDatabase<typeof schema>;

/**
 * Open the database connection (once) and return it.
 */
export async function initDatabase(): Promise<DrizzleDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  const filePath = sqliteFile();
  createFolderFor(filePath);

  databaseInstance = isDesktopRuntime() ? await connectWithNodeSqlite(filePath) : await connectWithLibSql(filePath);
  await runBundledMigrations();

  return databaseInstance;
}

/**
 * On every connect, apply the drizzle migration journal when the database is
 * fresh (zero tables). The desktop runtime ships migrations read via the
 * embedded VFS (relative to this module), so a packaged app never opens a
 * database without its tables. Dev databases already migrated by the maker
 * have tables and are left untouched - running the journal again would fail
 * on the ALTER/CREATE statements.
 */
async function runBundledMigrations(): Promise<void> {
  const folder = new URL("../../database/migrations/sqlite/", import.meta.url);
  let journal: { entries?: { tag: string }[] };
  try {
    journal = JSON.parse(await Deno.readTextFile(new URL("meta/_journal.json", folder)));
  } catch {
    return;
  }
  if (!journal.entries?.length || !databaseClient) return;

  if ((await countTables()) > 0) return;

  const exec = (sql: string): void | Promise<void> => {
    if (typeof (databaseClient as { exec?: unknown }).exec === "function") {
      (databaseClient as DatabaseSync).exec(sql);
      return;
    }
    return (databaseClient as LibSqlClient).executeMultiple(sql);
  };

  for (const entry of journal.entries) {
    const step = await Deno.readTextFile(new URL(`${entry.tag}.sql`, folder));
    await exec(step);
  }
}

/** Count user tables so we can detect a fresh database. */
async function countTables(): Promise<number> {
  const sql = "select count(*) as n from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle_%'";
  if (typeof (databaseClient as { exec?: unknown }).exec === "function") {
    const row = (databaseClient as DatabaseSync).prepare(sql).get() as { n: number };
    return Number(row.n);
  }
  const result = await (databaseClient as LibSqlClient).execute(sql);
  const row = result.rows[0] as { n?: bigint | number };
  return Number(row?.n ?? 0);
}

/** Connect using Deno's built-in node:sqlite through drizzle's sqlite proxy. */
async function connectWithNodeSqlite(filePath: string): Promise<DrizzleDatabase> {
  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/sqlite-proxy");

  const cleanPath = filePath.replace(/\\/g, "/").replace(/^file:/, "");
  const instance = new DatabaseSync(cleanPath);
  databaseClient = instance;

  return drizzle(
    // deno-lint-ignore require-await
    async (sql, params, method) => {
      const statement = instance.prepare(sql);
      const rows = readAllRows(statement, params);

      if (method === "get") {
        return { rows: rows.slice(0, 1) };
      }
      if (method === "all" || method === "values") {
        return { rows };
      }
      return { rows: [] };
    },
    { schema },
  ) as unknown as DrizzleDatabase;
}

/** Run a prepared statement and return its rows as arrays for the proxy. */
function readAllRows(statement: import("node:sqlite").StatementSync, params: unknown[]): unknown[][] {
  const values = params as import("node:sqlite").SQLInputValue[];
  return statement.all(...values).map((row: Record<string, unknown>) => Object.values(row));
}

/** Connect using the @libsql/client driver. */
async function connectWithLibSql(filePath: string): Promise<DrizzleDatabase> {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  const client = createClient({ url: `file:${filePath.replace(/\\/g, "/")}` });
  databaseClient = client;

  return drizzle(client, { schema }) as unknown as DrizzleDatabase;
}

/**
 * Return the open database. Throws if initDatabase was never called.
 */
export function database(): DrizzleDatabase {
  if (!databaseInstance) {
    throw new Error("Database is not initialized. Call initDatabase() first.");
  }
  return databaseInstance;
}

/**
 * The shared database namespace: lifecycle (`init`/`close`) plus the Drizzle
 * query client, all under one object surfaced through the facade.
 *
 * Use `await db.init()`, then `db.select()...`, `db.insert(...)`,
 * `db.update(...)`, `db.delete(...)`, `db.query.<table>.findMany(...)`.
 */
export const db: DrizzleDatabase & {
  init: typeof initDatabase;
  close: typeof closeDatabase;
} = new Proxy({} as DrizzleDatabase & {
  init: typeof initDatabase;
  close: typeof closeDatabase;
}, {
  get(_target, property) {
    if (property === "init") return initDatabase;
    if (property === "close") return closeDatabase;
    const value = database()[property as keyof DrizzleDatabase];
    return typeof value === "function" ? value.bind(database()) : value;
  },
});

/**
 * Close the connection and reset the singleton.
 */
export function closeDatabase(): void {
  if (databaseClient) {
    databaseClient.close();
  }
  databaseClient = null;
  databaseInstance = null;
}

/** Create the parent folder for a file path if it does not exist yet. */
function createFolderFor(filePath: string): void {
  const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (index === -1) return;
  Deno.mkdirSync(filePath.slice(0, index), { recursive: true });
}
