import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface StubValues {
  [key: string]: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STUBS_ROOT = join(__dirname, "stubs");

/**
 * Read a stub file and replace {{key}} placeholders, removing any that
 * remain unfilled.
 */
export function loadStub(name: string, values: StubValues): string {
  const file = join(STUBS_ROOT, name);
  let content = fs.readFileSync(file, "utf8");
  for (const [key, value] of Object.entries(values)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content.replace(/\{\{[A-Z0-9_]+\}\}/g, "");
}
