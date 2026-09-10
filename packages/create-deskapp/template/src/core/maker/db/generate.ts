import { generateMigrations, generateSchema } from "@/core/maker/db/helpers.ts";

/** db:schema - regenerate src/database/schema.ts from all models. */
export async function schema(): Promise<void> {
  await generateSchema();
}

/** db:generate - regenerate schema and create migration SQL. */
export async function generate(): Promise<void> {
  await generateMigrations();
}
