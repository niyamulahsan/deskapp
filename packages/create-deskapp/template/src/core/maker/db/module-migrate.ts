import { join, relative } from "@std/path";
import { ensureMigrationMeta, migrationCount, runDrizzle } from "./helpers.ts";
import { PROJECT_ROOT } from "./helpers.ts";

const MODULES_PATH = `${PROJECT_ROOT}src/modules`;

/** List the model files in a module's database/models directory. */
function moduleModels(moduleName: string): string[] {
  const modelsDir = join(MODULES_PATH, moduleName, "database", "models");
  const files: string[] = [];
  try {
    for (const entry of Deno.readDirSync(modelsDir)) {
      if (entry.isFile && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(join(modelsDir, entry.name));
      }
    }
  } catch {
    throw new Error(
      `Module does not exist: ${moduleName}. Create it first with: deno task maker make:module ${moduleName}`,
    );
  }
  if (!files.length) {
    throw new Error(`No model files found for module '${moduleName}'.`);
  }
  return files.sort();
}

/**
 * Write a temporary schema that re-exports only one module's models, so
 * drizzle-kit generates + migrates just that module (see db:migrate:module).
 */
async function writeModuleSchemaTemp(moduleName: string): Promise<string> {
  const tmpDir = join(PROJECT_ROOT, "src", "storage", "tmp");
  await Deno.mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `schema.${moduleName}.${Date.now()}.ts`);
  const exports = moduleModels(moduleName)
    .map((file) => {
      const rel = relative(tmpDir, file).replaceAll("\\", "/");
      const importPath = rel.startsWith(".") ? rel : `./${rel}`;
      return `export * from "${importPath}";`;
    })
    .join("\n");
  await Deno.writeTextFile(tmpPath, `${exports}\n`);
  return tmpPath;
}

/** db:migrate:module - generate + run migrations for one module's models. */
export async function migrateModule(moduleName: string, keepTemp = false): Promise<void> {
  await ensureMigrationMeta();
  const tmpPath = await writeModuleSchemaTemp(moduleName);
  const schemaEnv = {
    DRIZZLE_SCHEMA: `./${relative(PROJECT_ROOT, tmpPath).replaceAll("\\", "/")}`,
  };
  try {
    await runDrizzle(
      ["generate", ...(migrationCount() === 0 ? ["--name", "init"] : [])],
      schemaEnv,
    );
    await runDrizzle(["migrate"], schemaEnv);
    console.log(`Module migration complete: ${moduleName}`);
  } finally {
    if (!keepTemp) await Deno.remove(tmpPath).catch(() => {});
  }
}