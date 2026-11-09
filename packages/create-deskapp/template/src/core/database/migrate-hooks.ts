import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { db } from "@/core/database/connection";

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

const SRC_PATH = path.resolve(process.cwd(), "src");

function walkTs(dir: string, out: string[]): void {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkTs(full, out);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        out.push(full);
      }
    }
  } catch {}
}

function discoverModelFiles(): string[] {
  const files: string[] = [];
  const modulesDir = path.join(SRC_PATH, "modules");
  const coreDir = path.join(SRC_PATH, "core");

  if (fs.existsSync(modulesDir)) {
    for (const moduleDir of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      if (!moduleDir.isDirectory()) continue;
      walkTs(path.join(modulesDir, moduleDir.name, "database", "models"), files);
    }
  }
  if (fs.existsSync(coreDir)) {
    for (const areaDir of fs.readdirSync(coreDir, { withFileTypes: true })) {
      if (!areaDir.isDirectory()) continue;
      walkTs(path.join(coreDir, areaDir.name, "database", "models"), files);
    }
  }
  return files.sort();
}

const modelFiles = discoverModelFiles();
await db.init();

let applied = 0;
try {
  for (const file of modelFiles) {
    const mod = await import(pathToFileURL(file).href);
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