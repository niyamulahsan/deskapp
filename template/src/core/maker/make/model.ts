import path from "node:path";
import type { MakerOptions } from "@/core/maker/make/helpers";
import { assertModuleExists, assertName, modelContent, moduleDir, writeFile } from "./helpers";

export function makeModel(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const modelName = assertName(name, "Model name");
  assertModuleExists(moduleName);
  const filePath = path.join(moduleDir(moduleName), "database", "models", `${modelName}.model.ts`);
  writeFile(filePath, modelContent(moduleName, modelName), options, "Model file");
  if (!options.dryRun) {
    console.log(`Next: \`npm run maker -- db:generate\` (or \`db:migrate\`) to include '${modelName}' in the schema.`);
  }
}
