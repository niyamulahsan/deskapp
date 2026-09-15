import type { Command } from "@cliffy/command";
import { fromFileUrl } from "@std/path";
import { check, push, studio } from "@/core/maker/db/push.ts";
import { fresh } from "@/core/maker/db/fresh.ts";
import { generate, schema } from "@/core/maker/db/generate.ts";
import { migrate, migrateRun } from "@/core/maker/db/migrate.ts";
import { migrateModule } from "@/core/maker/db/module-migrate.ts";
import { reset } from "@/core/maker/db/reset.ts";
import { seed } from "@/core/maker/db/seed.ts";
import { status } from "@/core/maker/db/status.ts";

const ROOT = fromFileUrl(new URL("../../../../", import.meta.url));

function runSafe(action: () => Promise<void>): void {
  action().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    Deno.exit(1);
  });
}

/**
 * Regenerate src/core/api/bindings.generated.ts before any db command that
 * loads the application (migration hooks, seeders). The template ships a
 * pre-generated bindings file for its sample module, so removing or renaming
 * controllers leaves stale imports behind - regenerating first keeps it in
 * sync with whatever modules are actually present (fixes "Module not found:
 * ... demo.controller.ts" on db:migrate --seed after replacing sample modules).
 */
function regenerateBindings(): void {
  console.log(`== bindings:gen (pre-db) ==`);
  const { code } = new Deno.Command("deno", {
    args: ["run", "-A", "src/core/api/generate.manifest.ts"],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).outputSync();
  if (code !== 0) Deno.exit(code);
}

function withBindings(action: () => Promise<void>): () => Promise<void> {
  return async () => {
    regenerateBindings();
    await action();
  };
}

function seedModule(options: { module?: unknown }): string | undefined {
  const value = [options.module].flat().find((v) => typeof v === "string");
  return value as string | undefined;
}

/** Register the db:* subcommand family on the maker CLI. */
export function registerDbCommands(program: Command): void {
  program
    .command("db:schema", "Regenerate src/database/schema.ts from all models")
    .action(() => runSafe(schema))
    .command("db:generate", "Regenerate schema and create migration SQL")
    .action(() => runSafe(generate))
    .command(
      "db:migrate",
      "Generate+run migrations, apply model hooks (seed with --seed)",
    )
    .option("--seed", "Run seeders after migration")
    .action((options) => runSafe(withBindings(() => migrate(Boolean(options.seed)))))
    .command("db:migrate:run", "Run existing migrations + model hooks (no seed)")
    .action(() => runSafe(withBindings(migrateRun)))
    .command("db:migrate:module", "Generate + run migrations for one module's models")
    .arguments("<module:string>")
    .option("--keep-temp", "Keep the temporary schema file")
    .action((options, module) =>
      runSafe(withBindings(() => migrateModule(module, Boolean(options.keepTemp))))
    )
    .command("db:fresh", "Reset DB, then generate, migrate, hooks (seed with --seed)")
    .option("--seed", "Run seeders after fresh")
    .action((options) => runSafe(withBindings(() => fresh(Boolean(options.seed)))))
    .command("db:reset", "Delete the SQLite database file")
    .action(() => runSafe(reset))
    .command("db:wipe", "Delete the SQLite database file")
    .action(() => runSafe(reset))
    .command("db:status", "List generated migration files")
    .action(() => runSafe(status))
    .command("db:seed", "Run all seeders (auto FK-ordered)")
    .option("--module <module:string>", "Seed only one module")
    .action((options) => runSafe(withBindings(() => seed(seedModule(options)))))
    .command("db:push", "Push schema directly (drizzle-kit push)")
    .action(() => runSafe(push))
    .command("db:check", "Run drizzle-kit check")
    .action(() => runSafe(check))
    .command("db:studio", "Open Drizzle Studio")
    .action(() => runSafe(studio));
}
