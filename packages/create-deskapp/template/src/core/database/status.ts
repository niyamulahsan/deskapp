/**
 * status.ts - db:status script.
 *
 * Lists the generated SQL migration files for SQLite, mirroring the engine's
 * `migrationFiles()` (glob `src/database/migrations/sqlite/*.sql`).
 */

import { fromFileUrl, join } from "@std/path";

const PROJECT_ROOT = fromFileUrl(new URL("../../..", import.meta.url));
const MIGRATION_DIR = join(PROJECT_ROOT, "src", "database", "migrations", "sqlite");

const files: string[] = [];
try {
  for (const entry of Deno.readDirSync(MIGRATION_DIR)) {
    if (entry.isFile && entry.name.endsWith(".sql")) {
      files.push(entry.name);
    }
  }
} catch {
  // migrations dir does not exist yet
}

files.sort();

if (files.length === 0) {
  console.log("No generated migration files found.");
  Deno.exit(0);
}

console.log("Generated migrations:");
for (const file of files) {
  console.log(`  - ${file}`);
}
