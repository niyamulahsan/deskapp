import { join } from "@std/path";
import type { MakerOptions } from "@/core/maker/make/helpers.ts";
import { assertModuleExists, assertName, modelContent, moduleDir, writeFile } from "@/core/maker/make/helpers.ts";

/** make:model - create a model file in an existing module. */
export function makeModel(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const modelName = assertName(name, "Model name");
  assertModuleExists(moduleName);
  const filePath = join(moduleDir(moduleName), "database", "models", `${modelName}.model.ts`);
  writeFile(filePath, modelContent(moduleName, modelName), options, "Model file");
  if (!options.dryRun) {
    console.log(`Run \`deno task maker db:generate\` (or \`deno task maker db:migrate\`) to include '${modelName}' in the schema.`);
  }
}
