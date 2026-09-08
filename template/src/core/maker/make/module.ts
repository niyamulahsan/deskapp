import { join, resolve } from "@std/path";
import type { MakerOptions } from "./helpers.ts";
import {
  assertName,
  controllerContent,
  modelContent,
  modulesRoot,
  schemaContent,
  seederContent,
  writeFile,
} from "./helpers.ts";

/** make:module - create a module with a sample model, seeder, controller + schema. */
export function makeModule(name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(name, "Module name");
  const root = join(modulesRoot(), moduleName);
  let exists = false;
  try {
    exists = Deno.statSync(root).isDirectory;
  } catch {
    exists = false;
  }
  if (exists && !options.force) {
    throw new Error(`Module already exists: ${moduleName}.`);
  }
  if (options.dryRun) {
    console.log(`[dry-run] would create module: ${resolve(root)}`);
    console.log(`[dry-run]  - database/models/${moduleName}.model.ts`);
    console.log(`[dry-run]  - database/seeders/${moduleName}.seed.ts`);
    console.log(`[dry-run]  - controllers/${moduleName}.controller.ts`);
    console.log(`[dry-run]  - controllers/${moduleName}.schema.ts`);
    return;
  }

  Deno.mkdirSync(join(root, "database", "models"), { recursive: true });
  Deno.mkdirSync(join(root, "database", "seeders"), { recursive: true });
  Deno.mkdirSync(join(root, "controllers"), { recursive: true });

  writeFile(
    join(root, "database", "models", `${moduleName}.model.ts`),
    modelContent(moduleName, moduleName),
    options,
    "Model file",
  );
  writeFile(
    join(root, "database", "seeders", `${moduleName}.seed.ts`),
    seederContent(moduleName, moduleName),
    options,
    "Seeder file",
  );
  writeFile(
    join(root, "controllers", `${moduleName}.controller.ts`),
    controllerContent(moduleName, moduleName),
    options,
    "Controller file",
  );
  writeFile(
    join(root, "controllers", `${moduleName}.schema.ts`),
    schemaContent(moduleName, moduleName),
    options,
    "Schema file",
  );

  console.log(`Module ready: ${resolve(root)}`);
  console.log("Database files: database/models/{name}.model.ts, database/seeders/{name}.seed.ts");
  console.log("Controller + schema: controllers/{name}.controller.ts, controllers/{name}.schema.ts");
  console.log("Run `deno task maker db:generate` (or `deno task maker db:migrate`) to include the model in the schema.");
}
