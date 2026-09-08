/**
 * reset.ts - db:reset / db:wipe / db:fresh helper.
 *
 * SQLite-only: deletes the local .sqlite file so the next migrate rebuilds
 * from scratch. Mirrors the engine's `resetDatabase` for the sqlite dialect
 * (remove the file, then recreate the parent folder).
 */

import { fromFileUrl, resolve } from "@std/path";
import { sqliteFile } from "@/core/database/config.ts";

const PROJECT_ROOT = fromFileUrl(new URL("../../..", import.meta.url));

const raw = sqliteFile();
const file = resolve(PROJECT_ROOT, raw);

try {
  Deno.removeSync(file);
  console.log(`[db:reset] removed database file: ${file}`);
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    console.log(`[db:reset] no database file to remove: ${file}`);
  } else {
    console.error(`[db:reset] failed to remove database file: ${file}`);
    console.error(error);
    Deno.exit(1);
  }
}
