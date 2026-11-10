import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fresh } from "@/core/maker/db/fresh";
import { generate, schema } from "@/core/maker/db/generate";
import { migrate, migrateRun } from "@/core/maker/db/migrate";
import { migrateModule } from "@/core/maker/db/module-migrate";
import { check, push, studio } from "@/core/maker/db/push";
import { reset } from "@/core/maker/db/reset";
import { seed } from "@/core/maker/db/seed";
import { status } from "@/core/maker/db/status";
import type { CommandDef } from "@/core/maker/help";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function regenerateBindings(): void {
  console.log(`== bindings:gen (pre-db) ==`);
  const cmd = "npx";
  const args = ["--yes", "tsx", "--tsconfig", "tsconfig.json", "src/core/api/generate.manifest.ts"];
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "cmd.exe" : cmd, isWin ? ["/d", "/s", "/c", cmd, ...args] : args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    env: process.env
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function withBindings(action: () => Promise<void>): () => Promise<void> {
  return async () => {
    regenerateBindings();
    await action();
  };
}

const G = "Database";

export function registerDbCommands(register: (cmd: CommandDef) => void): void {
  register({ name: "db:schema", group: G, description: "Regenerate src/database/schema.ts from all models", action: () => schema() });
  register({
    name: "db:generate",
    group: G,
    description: "Regenerate schema and create migration SQL (drizzle-kit)",
    action: () => generate()
  });
  register({
    name: "db:migrate",
    usage: "[--seed]",
    group: G,
    description: "Generate + run migrations, apply hooks (seed with --seed)",
    action: (flags) => withBindings(() => migrate(Boolean(flags.seed)))()
  });
  register({
    name: "db:migrate:run",
    group: G,
    description: "Run existing migrations + model hooks (no seed)",
    action: () => withBindings(migrateRun)()
  });
  register({
    name: "db:migrate:module",
    usage: "<module> [--keep-temp]",
    group: G,
    description: "Generate + run migrations for one module's models",
    action: (flags, args) => {
      if (!args[0]) throw new Error("Module name is required.");
      return withBindings(() => migrateModule(args[0], Boolean(flags["keep-temp"])))();
    }
  });
  register({
    name: "db:fresh",
    usage: "[--seed]",
    group: G,
    description: "Reset DB, then generate, migrate, hooks (seed with --seed)",
    action: (flags) => withBindings(() => fresh(Boolean(flags.seed)))()
  });
  register({
    name: "db:seed",
    usage: "[--module <module>]",
    group: G,
    description: "Run seeders (all, or one module; auto FK-ordered)",
    action: (flags) => withBindings(() => seed(typeof flags.module === "string" ? flags.module : undefined))()
  });
  register({ name: "db:status", group: G, description: "List generated migration files", action: () => status() });
  register({ name: "db:push", group: G, description: "Push schema directly (drizzle-kit push)", action: () => push() });
  register({ name: "db:check", group: G, description: "Run drizzle-kit check", action: () => check() });
  register({ name: "db:studio", group: G, description: "Open Drizzle Studio", action: () => studio() });
  register({ name: "db:reset", group: G, description: "Delete the SQLite database file", action: () => reset() });
  register({ name: "db:wipe", group: G, description: "Delete the SQLite database file", action: () => reset() });
}
