import path from "node:path";
import type { MakerOptions } from "./helpers";
import { assertModuleExists, assertName, controllerContent, moduleDir, schemaContent, writeFile } from "./helpers";

export function makeController(module: string, name: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  const controllerName = assertName(name, "Controller name");
  assertModuleExists(moduleName);
  const controllersDir = path.join(moduleDir(moduleName), "controllers");
  writeFile(
    path.join(controllersDir, `${controllerName}.controller.ts`),
    controllerContent(moduleName, controllerName),
    options,
    "Controller file",
  );
  writeFile(
    path.join(controllersDir, `${controllerName}.schema.ts`),
    schemaContent(moduleName, controllerName),
    options,
    "Schema file",
  );
  if (!options.dryRun) {
    console.log(
      "Handlers are registered as `<module>.<name>.<handler>` via src/core/api/bindings.generated.ts. Run `npm run maker -- bindings:gen` then rebuild/restart Electron.",
    );
  }
}
