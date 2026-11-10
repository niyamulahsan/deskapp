import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATION_DIR = path.join(process.cwd(), "src", "database", "migrations", "sqlite");

export function listMigrations(dir = MIGRATION_DIR): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

function isMain(): boolean {
  try {
    const arg = process.argv[1];
    if (!arg) return false;
    return path.resolve(arg) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const found = listMigrations();
  if (found.length === 0) console.log("No generated migration files found.");
  else {
    console.log("Generated migrations:");
    for (const file of found) console.log(`  - ${file}`);
  }
}
