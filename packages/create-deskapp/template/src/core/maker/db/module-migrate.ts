import fs from "node:fs";
import path from "node:path";
import { ensureMigrationMeta, migrationCount, PROJECT_ROOT, runDrizzle } from "./helpers";

const MODULES_PATH = path.join(PROJECT_ROOT, "src", "modules");

function moduleModels(moduleName: string): string[] {
  const modelsDir = path.join(MODULES_PATH, moduleName, "database", "models");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(modelsDir, { withFileTypes: true });
  } catch {
    throw new Error(
      `Module does not exist: ${moduleName}. Create it first with: npm run maker -- make:module ${moduleName}`,
    );
  }
  const files = entries
    .filter((e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".tsx")))
    .map((e) => path.join(modelsDir, e.name))
    .sort();
  if (!files.length) throw new Error(`No model files found for module '${moduleName}'.`);
  return files;
}

async function writeModuleSchemaTemp(moduleName: string): Promise<string> {
  const tmpDir = path.join(PROJECT_ROOT, "src", "storage", "tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `schema.${moduleName}.${Date.now()}.ts`);
  const exports = moduleModels(moduleName)
    .map((file) => {
      const rel = path.relative(tmpDir, file).replaceAll("\\", "/");
      const importPath = rel.startsWith(".") ? rel : `./${rel}`;
      return `export * from "${importPath}";`;
    })
    .join("\n");
  fs.writeFileSync(tmpPath, `${exports}\n`, "utf8");
  return tmpPath;
}

export async function migrateModule(moduleName: string, keepTemp = false): Promise<void> {
  await ensureMigrationMeta();
  const tmpPath = await writeModuleSchemaTemp(moduleName);
  const schemaEnv = {
    DRIZZLE_SCHEMA: `./${path.relative(PROJECT_ROOT, tmpPath).replaceAll("\\", "/")}`,
  };
  try {
    await runDrizzle(["generate", ...(migrationCount() === 0 ? ["--name", "init"] : [])], schemaEnv);
    await runDrizzle(["migrate"], schemaEnv);
    console.log(`Module migration complete: ${moduleName}`);
  } finally {
    if (!keepTemp) try { fs.unlinkSync(tmpPath); } catch {}
  }
}
