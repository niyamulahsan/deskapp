import {
  ensureMigrationMeta,
  generateMigrations,
  generateSchema,
  hasExistingAppTables,
  migrationCount,
  runDrizzle,
  runScript,
  runSeedScript,
} from "./helpers.ts";

/** db:migrate - generate+run migrations, apply hooks, seed only with --seed. */
export async function migrate(seed = false): Promise<void> {
  await ensureMigrationMeta();
  const hadMigrationsBeforeGenerate = migrationCount() > 0;
  const hadExistingTablesBeforeGenerate = await hasExistingAppTables();
  await generateMigrations();
  if (!hadMigrationsBeforeGenerate && hadExistingTablesBeforeGenerate) {
    throw new Error(
      "Initial migration was generated, but the database already contains tables. " +
        "This usually means migration files were deleted while DB data still exists. " +
        "Use 'db:fresh --seed' to rebuild locally, or restore migration files before running db:migrate.",
    );
  }
  await runDrizzle(["migrate"]);
  await runScript("src/core/database/migrate-hooks.ts");
  if (seed) await runSeedScript();
}

/** db:migrate:run - run existing migrations + model hooks (no generate, no seed). */
export async function migrateRun(): Promise<void> {
  await generateSchema();
  await runDrizzle(["migrate"]);
  await runScript("src/core/database/migrate-hooks.ts");
}

