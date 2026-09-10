import { fromFileUrl, join, resolve } from "@std/path";
import { loadStub } from "@/core/maker/stub.ts";

export interface MakerOptions {
  force?: boolean;
  dryRun?: boolean;
}

export const PROJECT_ROOT = fromFileUrl(new URL("../../../..", import.meta.url));

export function assertName(value: string, label: string): string {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value.trim().toLowerCase();
}

export function pascal(input: string): string {
  return input.replace(/(^\w|[-_]\w)/g, (part) => part.replace(/[-_]/g, "").toUpperCase());
}

export function modulesRoot(): string {
  return join(PROJECT_ROOT, "src", "modules");
}

export function moduleDir(moduleName: string): string {
  return join(modulesRoot(), moduleName);
}

export function assertModuleExists(moduleName: string): void {
  const dir = moduleDir(moduleName);
  let isDir = false;
  try {
    isDir = Deno.statSync(dir).isDirectory;
  } catch {
    isDir = false;
  }
  if (!isDir) {
    throw new Error(
      `Module does not exist: ${moduleName}. Create it first with: deno task maker make:module ${moduleName}`,
    );
  }
}

export function writeFile(filePath: string, content: string, options: MakerOptions, label: string): void {
  if (options.dryRun) {
    console.log(`[dry-run] would write ${label}: ${resolve(filePath)}`);
    return;
  }
  let exists = false;
  try {
    exists = Deno.statSync(filePath).isFile;
  } catch {
    exists = false;
  }
  if (exists && !options.force) {
    throw new Error(
      `${label} already exists: ${resolve(filePath)}. Re-run with --force to overwrite.`,
    );
  }
  Deno.mkdirSync(resolve(join(filePath, "..")), { recursive: true });
  Deno.writeTextFileSync(filePath, content);
  console.log(`${label} ready: ${resolve(filePath)}`);
}

export function modelContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("model/model.stub", {
    tableName: `${name}s`,
    tableVariable: `${name}s`,
    ClassName,
    name,
    module,
  });
}

export function seederContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("seeder/seeder.stub", {
    module,
    name,
    ClassName,
    tableName: `${name}s`,
    tableVariable: `${name}s`,
  });
}

export function controllerContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("controller/controller.controller.stub", {
    module,
    controller: name,
    ClassName,
  });
}

export function schemaContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("controller/controller.schema.stub", {
    module,
    controller: name,
    ClassName,
  });
}
