import fs from "node:fs";
import { defineConfig } from "drizzle-kit";

// Mirror the runtime default (src/core/database/config.ts) so drizzle-kit and
// the app agree on the sqlite file, including the create-time project name.
function appKebab(): string {
  try {
    const pkg: { name?: string; build?: { productName?: string } } = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
    const name = pkg?.build?.productName?.trim() || pkg?.name?.trim() || "Deskapp";
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  } catch {
    return "deskapp";
  }
}

const databaseUrl = process.env.DATABASE_URL || `sqlite:./src/storage/${appKebab()}.sqlite`;

function sqlitePathFromUrl(url: string) {
  if (url.startsWith("sqlite:///")) return url.replace("sqlite:///", "");
  if (url.startsWith("sqlite://")) return url.replace("sqlite://", "");
  return url.replace("sqlite:", "");
}

export default defineConfig({
  schema: process.env.DRIZZLE_SCHEMA || "./src/database/schema.ts",
  out: "./src/database/migrations/sqlite",
  dialect: "sqlite",
  dbCredentials: { url: `file:${sqlitePathFromUrl(databaseUrl)}` }
});
