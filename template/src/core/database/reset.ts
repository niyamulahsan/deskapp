import fs from "node:fs";
import path from "node:path";
import { sqliteFile } from "@/core/database/config";

const raw = sqliteFile();
const file = path.resolve(process.cwd(), raw);

try {
  fs.unlinkSync(file);
  console.log(`[db:reset] removed database file: ${file}`);
} catch (error: any) {
  if (error.code === "ENOENT") {
    console.log(`[db:reset] no database file to remove: ${file}`);
  } else {
    console.error(`[db:reset] failed to remove database file: ${file}`);
    console.error(error);
    process.exit(1);
  }
}
