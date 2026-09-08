/**
 * migrate-hooks.ts - runs model migration hooks (db:migrate / db:migrate:run).
 *
 * Ported from the engine's migrate-hooks.ts, SQLite-only. Any model file in a
 * module's database/models folder can export a "hook map":
 *
 *   export const __migrationHooks = {
 *     __migrationSql: true,
 *     sqlite: ["ALTER TABLE ...", "CREATE INDEX ..."]
 *   };
 *
 * Every exported value with `__migrationSql === true` is collected; its
 * `.sqlite` strings are executed in order after the migration runs. This is
 * how you wire relation / index SQL that drizzle-kit cannot express.
 */

import { fromFileUrl, toFileUrl } from "@std/path";
import { sql } from "drizzle-orm";
import { db } from "@/core/facade.ts";

interface HookMap {
  __migrationSql: true;
  sqlite?: string[];
}

function isHookMap(value: unknown): value is HookMap {
  if (!value || typeof value !== "object") return false;
  return (value as HookMap).__migrationSql === true;
}

function collectStatements(exportsObj: Record<string, unknown>): string[] {
  const statements: string[] = [];
  for (const value of Object.values(exportsObj)) {
    if (!isHookMap(value)) continue;
    const list = value.sqlite || [];
    for (const statement of list) {
      if (typeof statement === "string" && statement.trim()) statements.push(statement);
    }
  }
  return statements;
}

const PROJECT_ROOT = fromFileUrl(new URL("../../..", import.meta.url));
const SRC_PATH = `${PROJECT_ROOT}src`;

function joinPath(base: string, name: string): string {
  return `${base.replace(/[\\/]+$/, "")}/${name}`;
}

function walkTs(dir: string, out: string[]): void {
  try {
    for (const entry of Deno.readDirSync(dir)) {
      const full = joinPath(dir, entry.name);
      if (entry.isDirectory) {
        walkTs(full, out);
      } else if (entry.isFile && entry.name.endsWith(".ts")) {
        out.push(full);
      }
    }
  } catch {
    // directory does not exist - skip
  }
}

function discoverModelFiles(): string[] {
  const files: string[] = [];
  for (const moduleDir of Deno.readDirSync(`${SRC_PATH}/modules`)) {
    if (!moduleDir.isDirectory) continue;
    walkTs(`${SRC_PATH}/modules/${moduleDir.name}/database/models`, files);
  }
  for (const areaDir of Deno.readDirSync(`${SRC_PATH}/core`)) {
    if (!areaDir.isDirectory) continue;
    walkTs(`${SRC_PATH}/core/${areaDir.name}/database/models`, files);
  }
  return files.sort();
}

const modelFiles = discoverModelFiles();
await db.init();

let applied = 0;
try {
  for (const file of modelFiles) {
    const mod = await import(toFileUrl(file).href);
    const statements = collectStatements(mod as Record<string, unknown>);
    if (!statements.length) continue;
    for (const statement of statements) {
      await db.run(sql.raw(statement));
    }
    applied += statements.length;
  }
} finally {
  await db.close();
}

if (applied > 0) {
  console.log(`Applied ${applied} model migration SQL statement(s) for sqlite.`);
}
