import { fromFileUrl, join, resolve } from "@std/path";
import { sqliteFile } from "@/core/database/config.ts";

export const PROJECT_ROOT = fromFileUrl(new URL("../../../..", import.meta.url));
export const DRIZZLE_KIT = "npm:drizzle-kit@0.31.10";

export async function runDeno(
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  const p = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", ...args],
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...Deno.env.toObject(), ...env },
  });
  const status = await p.output();
  if (!status.success) Deno.exit(status.code);
}

/** Run one of the database scripts in src/core/database. */
export async function runScript(path: string, extra: string[] = []): Promise<void> {
  await runDeno(["--env-file", path, ...extra]);
}

/** Run drizzle-kit with the given CLI args. */
export async function runDrizzle(
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  await runDeno(["--env-file", DRIZZLE_KIT, ...args], env);
}

/** Count existing SQL migration files (to pick the first-migration name). */
export function migrationCount(): number {
  const dir = join(PROJECT_ROOT, "src", "database", "migrations", "sqlite");
  let count = 0;
  try {
    for (const entry of Deno.readDirSync(dir)) {
      if (entry.isFile && entry.name.endsWith(".sql")) count++;
    }
  } catch {
    // migrations dir does not exist yet
  }
  return count;
}

export async function generateSchema(): Promise<void> {
  await runScript("src/core/database/aggregate.ts");
}

export async function generateMigrations(): Promise<void> {
  await generateSchema();
  await runDrizzle([
    "generate",
    ...(migrationCount() === 0 ? ["--name", "init"] : []),
  ]);
}

export async function runSeedScript(module?: string): Promise<void> {
  await runScript(
    "src/core/database/seed.ts",
    module ? [`--module=${module}`] : [],
  );
}

/**
 * Mirror the engine's `ensureMigrationMeta` for SQLite. Creates the
 * migrations/meta/_journal.json (drizzle-kit v7 format) if it is missing so
 * the very first `db:migrate` starts from a clean journal.
 */
export async function ensureMigrationMeta(): Promise<void> {
  const metaRoot = join(PROJECT_ROOT, "src", "database", "migrations", "sqlite", "meta");
  const journalPath = join(metaRoot, "_journal.json");
  await Deno.mkdir(metaRoot, { recursive: true });
  try {
    await Deno.stat(journalPath);
  } catch {
    await Deno.writeTextFile(
      journalPath,
      `{
  "version": "7",
  "dialect": "sqlite",
  "entries": []
}
`,
    );
    console.log(`[db:migrate] created migration journal: ${journalPath}`);
  }
}

/**
 * Mirror the engine's `hasExistingAppTables` for SQLite. Returns true when the
 * local database file already contains app tables (excluding SQLite's system
 * tables and drizzle's own migration bookkeeping table).
 */
export async function hasExistingAppTables(): Promise<boolean> {
  const raw = sqliteFile();
  const file = resolve(PROJECT_ROOT, raw);

  try {
    try {
      await Deno.stat(file);
    } catch {
      return false;
    }
    const { DatabaseSync } = await import("node:sqlite");
    const instance = new DatabaseSync(file);
    try {
      const rows = instance
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
        )
        .all();
      return rows.length > 0;
    } finally {
      instance.close();
    }
  } catch {
    return false;
  }
}
