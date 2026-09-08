import { runScript } from "./helpers.ts";
import { migrate } from "./migrate.ts";

/** db:fresh - reset DB, then generate, migrate, hooks; seed only with --seed. */
export async function fresh(seed = false): Promise<void> {
  await runScript("src/core/database/reset.ts");
  await migrate(seed);
}
