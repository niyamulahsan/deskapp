import type { Command } from "@cliffy/command";
import { check, push, studio } from "./push.ts";
import { fresh } from "./fresh.ts";
import { generate, schema } from "./generate.ts";
import { migrate, migrateRun } from "./migrate.ts";
import { migrateModule } from "./module-migrate.ts";
import { reset } from "./reset.ts";
import { seed } from "./seed.ts";
import { status } from "./status.ts";

function runSafe(action: () => Promise<void>): void {
  action().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    Deno.exit(1);
  });
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
    .action((options) => runSafe(() => migrate(Boolean(options.seed))))
    .command("db:migrate:run", "Run existing migrations + model hooks (no seed)")
    .action(() => runSafe(migrateRun))
    .command("db:migrate:module", "Generate + run migrations for one module's models")
    .arguments("<module:string>")
    .option("--keep-temp", "Keep the temporary schema file")
    .action((options, module) =>
      runSafe(() => migrateModule(module, Boolean(options.keepTemp)))
    )
    .command("db:fresh", "Reset DB, then generate, migrate, hooks (seed with --seed)")
    .option("--seed", "Run seeders after fresh")
    .action((options) => runSafe(() => fresh(Boolean(options.seed))))
    .command("db:reset", "Delete the SQLite database file")
    .action(() => runSafe(reset))
    .command("db:wipe", "Delete the SQLite database file")
    .action(() => runSafe(reset))
    .command("db:status", "List generated migration files")
    .action(() => runSafe(status))
    .command("db:seed", "Run all seeders (auto FK-ordered)")
    .option("--module <module:string>", "Seed only one module")
    .action((options) => runSafe(() => seed(seedModule(options))))
    .command("db:push", "Push schema directly (drizzle-kit push)")
    .action(() => runSafe(push))
    .command("db:check", "Run drizzle-kit check")
    .action(() => runSafe(check))
    .command("db:studio", "Open Drizzle Studio")
    .action(() => runSafe(studio));
}
