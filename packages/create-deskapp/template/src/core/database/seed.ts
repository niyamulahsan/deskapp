// deno-lint-ignore-file no-explicit-any
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "@/core/database/connection";

const NAME_SYMBOL = Symbol.for("drizzle:Name");
const FK_SYMBOLS = [Symbol.for("drizzle:SQLiteInlineForeignKeys")];

interface SeederEntry {
  name: string;
  module: string;
  execute: () => Promise<void>;
  tableName?: string;
  dependsOn: string[];
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

function getTableDeps(table: any): string[] {
  for (const sym of FK_SYMBOLS) {
    const fks = table?.[sym] as any[] | undefined;
    if (!fks || fks.length === 0) continue;
    const deps: string[] = [];
    for (const fk of fks) {
      const ref = fk.reference();
      const name = ref?.foreignTable?.[NAME_SYMBOL] as string | undefined;
      if (name && !deps.includes(name)) deps.push(name);
    }
    return deps;
  }
  return [];
}

function discoverSeederFiles(): string[] {
  const files: string[] = [];
  const modulesDir = path.join(SRC_PATH, "modules");
  const coreDir = path.join(SRC_PATH, "core");

  if (fs.existsSync(modulesDir)) {
    for (const moduleDir of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      if (!moduleDir.isDirectory()) continue;
      walkTs(path.join(modulesDir, moduleDir.name, "database", "seeders"), files);
    }
  }
  if (fs.existsSync(coreDir)) {
    for (const areaDir of fs.readdirSync(coreDir, { withFileTypes: true })) {
      if (!areaDir.isDirectory()) continue;
      walkTs(path.join(coreDir, areaDir.name, "database", "seeders"), files);
    }
  }
  return files.sort();
}

function moduleNameOf(file: string): string {
  const rel = path.relative(SRC_PATH, file).replace(/\\/g, "/");
  const root = rel.startsWith("core/") ? "core" : "modules";
  return rel.slice(root.length + 1).split("/")[0];
}

// Parse `--module=blog` from process.argv
const moduleArg = process.argv.find((arg) => arg.startsWith("--module="));
const moduleName = moduleArg?.split("=")[1]?.trim();

const seedFiles = moduleName ? discoverSeederFiles().filter((f) => moduleNameOf(f) === moduleName) : discoverSeederFiles();

await db.init();

try {
  const seeders: SeederEntry[] = [];
  for (const file of seedFiles) {
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.default !== "function") continue;

    const table: any = mod.table;
    const rawName = path.basename(file).replace(/\.ts$/, "");
    seeders.push({
      name: rawName.replace(/\.seed$/, ""),
      module: moduleNameOf(file),
      execute: () => mod.default(),
      tableName: table?.[NAME_SYMBOL] as string | undefined,
      dependsOn: table ? getTableDeps(table) : []
    });
  }

  if (seeders.length === 0) {
    console.log(`No seeders found${moduleName ? ` for module ${moduleName}` : ""}`);
    process.exit(0);
  }

  const tableToSeeder = new Map<string, SeederEntry>();
  for (const s of seeders) {
    if (s.tableName) tableToSeeder.set(s.tableName, s);
  }

  const resolvedDeps = new Map<SeederEntry, SeederEntry[]>();
  for (const s of seeders) {
    const deps: SeederEntry[] = [];
    for (const dep of s.dependsOn) {
      const depSeeder = tableToSeeder.get(dep);
      if (depSeeder && depSeeder !== s && !deps.includes(depSeeder)) {
        deps.push(depSeeder);
      }
    }
    resolvedDeps.set(s, deps);
  }

  const inDegree = new Map<SeederEntry, number>();
  const adj = new Map<SeederEntry, SeederEntry[]>();

  for (const s of seeders) {
    inDegree.set(s, 0);
    adj.set(s, []);
  }

  for (const s of seeders) {
    for (const dep of resolvedDeps.get(s)!) {
      if (!adj.has(dep)) continue;
      adj.get(dep)!.push(s);
      inDegree.set(s, inDegree.get(s)! + 1);
    }
  }

  const queue: SeederEntry[] = [];
  for (const [s, deg] of inDegree) {
    if (deg === 0) queue.push(s);
  }

  const sorted: SeederEntry[] = [];
  while (queue.length > 0) {
    const s = queue.shift()!;
    sorted.push(s);
    for (const next of adj.get(s)!) {
      const newDeg = inDegree.get(next)! - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== seeders.length) {
    const seeded = new Set(sorted.map((s) => s.name));
    const missing = seeders.filter((s) => !seeded.has(s.name)).map((s) => s.name);
    console.error(`Circular dependency detected among seeders: ${missing.join(", ")}`);
    process.exit(1);
  }

  for (const s of sorted) {
    await s.execute();
  }

  console.log(`Executed ${sorted.length} seeder file(s)${moduleName ? ` for module ${moduleName}` : ""}`);
} finally {
  await db.close();
}
