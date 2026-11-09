import path from "node:path";
import { loadStub } from "../stub";
import type { MakerOptions } from "./helpers";
import { assertModuleExists, assertName, moduleDir, writeFile } from "./helpers";

/**
 * make:test / module:make-test - create a Vitest file in a module's __tests__ folder.
 * Nexwire-style: `module:make-test <module> [name]` -> __tests__/<name|module>.test.ts
 */
export function makeTest(module: string, name?: string, options: MakerOptions = {}): void {
  const moduleName = assertName(module, "Module name");
  assertModuleExists(moduleName);
  const rawName = name && name.trim() ? assertName(name, "Test name") : moduleName;
  // strip trailing .test/.spec if provided
  const testName = rawName.replace(/\.(test|spec)$/i, "");

  const filePath = path.join(moduleDir(moduleName), "__tests__", `${testName}.test.ts`);
  const content = loadStub("test/test.stub", {
    module: moduleName,
    name: testName === moduleName ? "" : testName
  }).replace(/\{\{#name\}\}[\s\S]*?\{\{\/name\}\}/g, (m) => {
    // simple conditional: keep inner text when name is non-empty
    return testName === moduleName ? "" : m.replace(/\{\{#name\}\}|\{\{\/name\}\}/g, "");
  });

  writeFile(filePath, content, options, "Test file");
  if (!options.dryRun) {
    console.log(`Run tests with: npm test (or \`npm run maker -- test\`).`);
  }
}
