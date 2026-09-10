import { join } from "@std/path";
import type { MakerOptions } from "@/core/maker/make/helpers.ts";
import { assertModuleExists, assertName, moduleDir, seederContent, writeFile } from "@/core/maker/make/helpers.ts";

/** make:seeder - create a seeder file for a module model. */
export function makeSeeder(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const seederName = assertName(name, "Seeder name");
  assertModuleExists(moduleName);
  const modelPath = join(
    moduleDir(moduleName),
    "database",
    "models",
    `${seederName}.model.ts`,
  );
  try {
    if (!Deno.statSync(modelPath).isFile) throw new Error();
  } catch {
    throw new Error(
      `Model not found for seeder: src/modules/${moduleName}/database/models/${seederName}.model.ts. Create it first with: deno task maker make:model ${moduleName} ${seederName}`,
    );
  }
  const filePath = join(moduleDir(moduleName), "database", "seeders", `${seederName}.seed.ts`);
  writeFile(filePath, seederContent(moduleName, seederName), options, "Seeder file");
  if (!options.dryRun) {
    console.log(
      "Fills seed values from parent FKs manually; ordering is resolved automatically by the seeder runner.",
    );
  }
}
