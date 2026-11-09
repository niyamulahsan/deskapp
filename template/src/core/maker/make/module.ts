import fs from "node:fs";
import path from "node:path";
import type { MakerOptions } from "./helpers";
import {
  assertName,
  controllerContent,
  modelContent,
  modulesRoot,
  schemaContent,
  seederContent,
  writeFile,
} from "./helpers";

export function makeModule(name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(name, "Module name");
  const root = path.join(modulesRoot(), moduleName);
  const exists = fs.existsSync(root) && fs.statSync(root).isDirectory();
  if (exists && !options.force) throw new Error(`Module already exists: ${moduleName}.`);

  if (options.dryRun) {
    console.log(`[dry-run] would create module: ${path.resolve(root)}`);
    console.log(`[dry-run]  - database/models/${moduleName}.model.ts`);
    console.log(`[dry-run]  - database/seeders/${moduleName}.seed.ts`);
    console.log(`[dry-run]  - controllers/${moduleName}.controller.ts`);
    console.log(`[dry-run]  - controllers/${moduleName}.schema.ts`);
    return;
  }

  fs.mkdirSync(path.join(root, "database", "models"), { recursive: true });
  fs.mkdirSync(path.join(root, "database", "seeders"), { recursive: true });
  fs.mkdirSync(path.join(root, "controllers"), { recursive: true });

  writeFile(
    path.join(root, "database", "models", `${moduleName}.model.ts`),
    modelContent(moduleName, moduleName),
    options,
    "Model file",
  );
  writeFile(
    path.join(root, "database", "seeders", `${moduleName}.seed.ts`),
    seederContent(moduleName, moduleName),
    options,
    "Seeder file",
  );
  writeFile(
    path.join(root, "controllers", `${moduleName}.controller.ts`),
    controllerContent(moduleName, moduleName),
    options,
    "Controller file",
  );
  writeFile(
    path.join(root, "controllers", `${moduleName}.schema.ts`),
    schemaContent(moduleName, moduleName),
    options,
    "Schema file",
  );

  console.log(`Module ready: ${path.resolve(root)}`);
  console.log("Database files: database/models/{name}.model.ts, database/seeders/{name}.seed.ts");
  console.log("Controller + schema: controllers/{name}.controller.ts, controllers/{name}.schema.ts");
  console.log("Next: `npm run maker -- db:generate` (or `db:migrate`), then `npm run maker -- bindings:gen` and rebuild Electron.");
}
