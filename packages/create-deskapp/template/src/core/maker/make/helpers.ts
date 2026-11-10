import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStub } from "@/core/maker/stub";

export interface MakerOptions {
  force?: boolean;
  dryRun?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/core/maker/make -> project root
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

export function assertName(value: string, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value.trim().toLowerCase();
}

export function pascal(input: string): string {
  return input.replace(/(^\w|[-_]\w)/g, (part) => part.replace(/[-_]/g, "").toUpperCase());
}

export function modulesRoot(): string {
  return path.join(PROJECT_ROOT, "src", "modules");
}

export function moduleDir(moduleName: string): string {
  return path.join(modulesRoot(), moduleName);
}

export function assertModuleExists(moduleName: string): void {
  const dir = moduleDir(moduleName);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Module does not exist: ${moduleName}. Create it first with: npm run maker -- make:module ${moduleName}`);
  }
}

export function writeFile(filePath: string, content: string, options: MakerOptions, label: string): void {
  const target = path.resolve(filePath);
  if (options.dryRun) {
    console.log(`[dry-run] would write ${label}: ${target}`);
    return;
  }
  if (fs.existsSync(target) && !options.force) {
    throw new Error(`${label} already exists: ${target}. Re-run with --force to overwrite.`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log(`${label} ready: ${target}`);
}

export function modelContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("model/model.stub", {
    tableName: `${name}s`,
    tableVariable: `${name}s`,
    ClassName,
    name,
    module
  });
}

export function seederContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("seeder/seeder.stub", {
    module,
    name,
    ClassName,
    tableName: `${name}s`,
    tableVariable: `${name}s`
  });
}

export function controllerContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("controller/controller.controller.stub", {
    module,
    controller: name,
    ClassName
  });
}

export function schemaContent(module: string, name: string): string {
  const ClassName = pascal(name);
  return loadStub("controller/controller.schema.stub", {
    module,
    controller: name,
    ClassName
  });
}
