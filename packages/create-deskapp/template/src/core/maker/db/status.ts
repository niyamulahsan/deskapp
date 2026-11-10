import { runScript } from "@/core/maker/db/helpers";

/** db:status - list generated migration files. */
export async function status(): Promise<void> {
  await runScript("src/core/database/status.ts");
}
