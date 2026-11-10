import { runScript } from "@/core/maker/db/helpers";
import { migrate } from "@/core/maker/db/migrate";

/** db:fresh - reset DB, then generate, migrate, hooks; seed only with --seed. */
export async function fresh(seed = false): Promise<void> {
  await runScript("src/core/database/reset.ts");
  await migrate(seed);
}
