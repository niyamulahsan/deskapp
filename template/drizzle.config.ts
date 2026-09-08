import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || "sqlite:./src/storage/deskapp.sqlite";

function sqlitePathFromUrl(url: string) {
  if (url.startsWith("sqlite:///")) return url.replace("sqlite:///", "");
  if (url.startsWith("sqlite://")) return url.replace("sqlite://", "");
  return url.replace("sqlite:", "");
}

export default defineConfig({
  schema: process.env.DRIZZLE_SCHEMA || "./src/database/schema.ts",
  out: "./src/database/migrations/sqlite",
  dialect: "sqlite",
  dbCredentials: { url: `file:${sqlitePathFromUrl(databaseUrl)}` },
});
