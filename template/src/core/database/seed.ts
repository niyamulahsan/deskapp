// deno-lint-ignore-file no-explicit-any
/**
 * seed.ts - CLI seed runner. Discovers seeder files at runtime, resolves FK
 * dependencies between them, and executes them in dependency order.
 *
 * Ordering is fully automatic: each seeder exports its `table`, and the runner
 * inspects the table's foreign keys to decide which seeders must run first.
 * You only need to look up and wire the actual parent IDs inside each seeder.
 *
 * Usage:  deno task maker db:seed
 *         deno task maker db:seed --module=blog  (seed one module only)
 */

import { fromFileUrl, toFileUrl } from "@std/path";
import { db } from "@/core/facade.ts";

const NAME_SYMBOL = Symbol.for("drizzle:Name");
const FK_SYMBOLS = [Symbol.for("drizzle:SQLiteInlineForeignKeys")];

interface SeederEntry {
  name: string;
  module: string;
  execute: () => Promise<void>;
  tableName?: string;
  dependsOn: string[];
}

const PROJECT_ROOT = fromFileUrl(new URL("../../../", import.meta.url));
const SRC_PATH = `${PROJECT_ROOT}src`;

/** Recursively collect every .ts file under a directory (if it exists). */
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

/** Join a POSIX-style base path with a segment name. */
function joinPath(base: string, name: string): string {
  return `${base.replace(/[\\/]+$/, "")}/${name}`;
}

/** Read every foreign-key table name referenced by a Drizzle table. */
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

/** Discover every seeder file across modules and core areas. */
function discoverSeederFiles(): string[] {
  const files: string[] = [];

  for (const moduleDir of Deno.readDirSync(`${SRC_PATH}/modules`)) {
    if (!moduleDir.isDirectory) continue;
    walkTs(`${SRC_PATH}/modules/${moduleDir.name}/database/seeders`, files);
  }
  for (const areaDir of Deno.readDirSync(`${SRC_PATH}/core`)) {
    if (!areaDir.isDirectory) continue;
    walkTs(`${SRC_PATH}/core/${areaDir.name}/database/seeders`, files);
  }

  return files.sort();
}

/** Derive the module name from a discovered file path. */
function moduleNameOf(file: string): string {
  const rel = file.replace(SRC_PATH + "/", "").replace(/\\/g, "/");
  const root = rel.startsWith("core/") ? "core" : "modules";
  return rel.slice(root.length + 1).split("/")[0];
}

// -- main --------------------------------------------------------------------

const moduleArg = Deno.args.find((arg) => arg.startsWith("--module="));
const moduleName = moduleArg?.split("=")[1]?.trim();

const seedFiles = moduleName ? discoverSeederFiles().filter((f) => moduleNameOf(f) === moduleName) : discoverSeederFiles();

await db.init();

try {
  const seeders: SeederEntry[] = [];
  for (const file of seedFiles) {
    const mod = await import(toFileUrl(file).href);
    if (typeof mod.default !== "function") continue;

    const table: any = mod.table;
    const rawName = file.split(/[\\/]/).pop()!.replace(/\.ts$/, "");
    seeders.push({
      name: rawName.replace(/\.seed$/, ""),
      module: moduleNameOf(file),
      execute: () => mod.default(),
      tableName: table?.[NAME_SYMBOL] as string | undefined,
      dependsOn: table ? getTableDeps(table) : [],
    });
  }

  if (seeders.length === 0) {
    console.log(`No seeders found${moduleName ? ` for module ${moduleName}` : ""}`);
    Deno.exit(0);
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
    Deno.exit(1);
  }

  for (const s of sorted) {
    await s.execute();
  }

  console.log(`Executed ${sorted.length} seeder file(s)${moduleName ? ` for module ${moduleName}` : ""}`);
} finally {
  await db.close();
}
