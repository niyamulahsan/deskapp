import fs from "node:fs";
import path from "node:path";
import type { MakerOptions } from "@/core/maker/make/helpers";
import { assertModuleExists, assertName, moduleDir, seederContent, writeFile } from "./helpers";

export function makeSeeder(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const seederName = assertName(name, "Seeder name");
  assertModuleExists(moduleName);
  const modelPath = path.join(moduleDir(moduleName), "database", "models", `${seederName}.model.ts`);
  if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isFile()) {
    throw new Error(
      `Model not found for seeder: src/modules/${moduleName}/database/models/${seederName}.model.ts. Create it first with: npm run maker -- make:model ${moduleName} ${seederName}`
    );
  }
  const filePath = path.join(moduleDir(moduleName), "database", "seeders", `${seederName}.seed.ts`);
  writeFile(filePath, seederContent(moduleName, seederName), options, "Seeder file");
  if (!options.dryRun) {
    console.log("Fills seed values from parent FKs manually; ordering is resolved automatically by the seeder runner.");
  }
}
