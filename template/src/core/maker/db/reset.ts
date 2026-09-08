import { runScript } from "./helpers.ts";

/** db:reset / db:wipe - delete the SQLite database file only. */
export async function reset(): Promise<void> {
  await runScript("src/core/database/reset.ts");
}
