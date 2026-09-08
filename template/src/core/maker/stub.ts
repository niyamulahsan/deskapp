import { fromFileUrl, join } from "@std/path";

export interface StubValues {
  [key: string]: string;
}

const STUBS_ROOT = fromFileUrl(new URL("./stubs/", import.meta.url));

/**
 * Read a stub file and replace {{key}} placeholders, removing any that
 * remain unfilled. Ported from the engine's maker-cli stub() helper so stub
 * templates live as real files under src/core/maker/stubs.
 */
export function loadStub(name: string, values: StubValues): string {
  const file = join(STUBS_ROOT, name);
  let content = Deno.readTextFileSync(file);
  for (const [key, value] of Object.entries(values)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content.replace(/\{\{[A-Z0-9_]+\}\}/g, "");
}
