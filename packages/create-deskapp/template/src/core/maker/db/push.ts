import { generateSchema, runDrizzle } from "@/core/maker/db/helpers.ts";

async function withSchema(args: string[]): Promise<void> {
  await generateSchema();
  await runDrizzle(args);
}

/** db:push - push schema directly to the database. */
export async function push(): Promise<void> {
  await withSchema(["push"]);
}

/** db:check - run drizzle-kit check. */
export async function check(): Promise<void> {
  await withSchema(["check"]);
}

/** db:studio - open Drizzle Studio. */
export async function studio(): Promise<void> {
  await withSchema(["studio"]);
}
