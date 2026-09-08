import { generateSchema, runSeedScript } from "./helpers.ts";

/** db:seed - run all seeders (auto FK-ordered), or one module's seeders. */
export async function seed(module?: string): Promise<void> {
  await generateSchema();
  await runSeedScript(module);
}
