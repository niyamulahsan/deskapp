import { join } from "@std/path";
import type { MakerOptions } from "@/core/maker/make/helpers.ts";
import {
  assertModuleExists,
  assertName,
  controllerContent,
  moduleDir,
  schemaContent,
  writeFile,
} from "@/core/maker/make/helpers.ts";

/** make:controller - create a controller + schema pair for a module. */
export function makeController(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const controllerName = assertName(name, "Controller name");
  assertModuleExists(moduleName);
  const controllersDir = join(moduleDir(moduleName), "controllers");
  writeFile(
    join(controllersDir, `${controllerName}.controller.ts`),
    controllerContent(moduleName, controllerName),
    options,
    "Controller file",
  );
  writeFile(
    join(controllersDir, `${controllerName}.schema.ts`),
    schemaContent(moduleName, controllerName),
    options,
    "Schema file",
  );
  if (!options.dryRun) {
    console.log(
      "Handlers are registered automatically as `<module>.<name>.<handler>` and callable from the frontend via `bindings`.",
    );
  }
}
