import type { Client as LibSqlClient } from "@libsql/client";
import fs from "node:fs/promises";
import path from "node:path";
import * as schema from "@/database/schema";
import { sqliteFile } from "@/core/database/config";

let databaseInstance: DrizzleDatabase | null = null;
let databaseClient: LibSqlClient | null = null;

export type DrizzleDatabase = import("drizzle-orm/libsql").LibSQLDatabase<typeof schema>;

function resolveMigrationsDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const e = require("electron") as any;
    if (typeof e?.app?.getAppPath === "function") {
      const dir = path.join(e.app.getAppPath(), "src", "database", "migrations", "sqlite");
      if (require("node:fs").existsSync(dir)) return dir;
    }
  } catch {}
  // CLI/dev fallback: find project root
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "src", "database", "migrations", "sqlite");
    if (require("node:fs").existsSync(path.join(dir, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "src", "database", "migrations", "sqlite");
}

export async function initDatabase(): Promise<DrizzleDatabase> {
  if (databaseInstance) return databaseInstance;

  const filePath = sqliteFile();
  await createFolderFor(filePath);

  databaseInstance = await connectWithLibSql(filePath);
  await runBundledMigrations();

  return databaseInstance;
}

async function runBundledMigrations(): Promise<void> {
  const folder = resolveMigrationsDir();
  let journal: { entries?: { tag: string }[] };

  try {
    const journalRaw = await fs.readFile(path.join(folder, "meta", "_journal.json"), "utf-8");
    journal = JSON.parse(journalRaw);
  } catch {
    return;
  }

  if (!journal.entries?.length || !databaseClient) return;
  if ((await countTables()) > 0) return;

  for (const entry of journal.entries) {
    try {
      const step = await fs.readFile(path.join(folder, `${entry.tag}.sql`), "utf-8");
      await databaseClient.executeMultiple(step);
    } catch (err) {
      console.error(`[db] Failed to run migration ${entry.tag}`, err);
    }
  }
}

async function countTables(): Promise<number> {
  const sql = "select count(*) as n from sqlite_master where type='table' and name not like 'sqlite_%' and name not like '__drizzle_%'";
  const result = await databaseClient!.execute(sql);
  const row = result.rows[0] as { n?: bigint | number };
  return Number(row?.n ?? 0);
}

async function connectWithLibSql(filePath: string): Promise<DrizzleDatabase> {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  // libsql requires forward slashes even on Windows
  const normalizedPath = filePath.replace(/\\/g, "/");
  const client = createClient({ url: `file:${normalizedPath}` });
  databaseClient = client;

  return drizzle(client, { schema }) as unknown as DrizzleDatabase;
}

export function database(): DrizzleDatabase {
  if (!databaseInstance) throw new Error("Database is not initialized.");
  return databaseInstance;
}

export const db: DrizzleDatabase & {
  init: typeof initDatabase;
  close: typeof closeDatabase;
} = new Proxy({} as any, {
  get(_target, property) {
    if (property === "init") return initDatabase;
    if (property === "close") return closeDatabase;
    const value = database()[property as keyof DrizzleDatabase];
    return typeof value === "function" ? value.bind(database()) : value;
  },
});

export function closeDatabase(): void {
  if (databaseClient) databaseClient.close();
  databaseClient = null;
  databaseInstance = null;
}

async function createFolderFor(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}