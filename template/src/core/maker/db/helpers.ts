import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { sqliteFile } from "@/core/database/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/core/maker/db -> project root
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function envFileArgs(): string[] {
  const envPath = path.join(PROJECT_ROOT, ".env");
  return fs.existsSync(envPath) ? ["--env-file=.env"] : [];
}

function run(cmd: string, args: string[], env: Record<string, string> = {}): void {
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "cmd.exe" : cmd, isWin ? ["/d", "/s", "/c", cmd, ...args] : args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** Run a TS script via tsx (supports @/ aliases and TS). */
export async function runScript(scriptPath: string, extra: string[] = []): Promise<void> {
  run("npx", ["--yes", "tsx", "--tsconfig", "tsconfig.json", ...envFileArgs(), scriptPath, ...extra]);
}

/** Run drizzle-kit with the given CLI args. */
export async function runDrizzle(args: string[], env: Record<string, string> = {}): Promise<void> {
  run("npx", ["--yes", "drizzle-kit", ...args], env);
}

export function migrationCount(): number {
  const dir = path.join(PROJECT_ROOT, "src", "database", "migrations", "sqlite");
  let count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".sql")) count++;
    }
  } catch {}
  return count;
}

export async function generateSchema(): Promise<void> {
  await runScript("src/core/database/aggregate.ts");
}

export async function generateMigrations(): Promise<void> {
  await generateSchema();
  await runDrizzle(["generate", ...(migrationCount() === 0 ? ["--name", "init"] : [])]);
}

export async function runSeedScript(module?: string): Promise<void> {
  await runScript("src/core/database/seed.ts", module ? [`--module=${module}`] : []);
}

export async function ensureMigrationMeta(): Promise<void> {
  const metaRoot = path.join(PROJECT_ROOT, "src", "database", "migrations", "sqlite", "meta");
  const journalPath = path.join(metaRoot, "_journal.json");
  fs.mkdirSync(metaRoot, { recursive: true });
  if (!fs.existsSync(journalPath)) {
    fs.writeFileSync(
      journalPath,
      `{\n  "version": "7",\n  "dialect": "sqlite",\n  "entries": []\n}\n`,
      "utf8",
    );
    console.log(`[db:migrate] created migration journal: ${journalPath}`);
  }
}

export async function hasExistingAppTables(): Promise<boolean> {
  try {
    const raw = sqliteFile();
    const file = path.isAbsolute(raw) ? raw : path.resolve(PROJECT_ROOT, raw);
    if (!fs.existsSync(file)) return false;
    const instance = new DatabaseSync(file);
    try {
      const rows = instance
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
        )
        .all() as unknown[];
      return rows.length > 0;
    } finally {
      instance.close();
    }
  } catch {
    return false;
  }
}
