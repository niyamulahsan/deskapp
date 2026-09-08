import { fromFileUrl, join } from "@std/path";

/**
 * deno.controller.ts - demo controller proving backend -> frontend bindings.
 *
 * Exposes a single handler that reads this project's `deno.json` on the backend
 * and returns it to the webview. The bindings registry discovers this file and
 * automatically binds the handler as `app.deno.readConfig` (no HTTP/IPC).
 */

const ROOT = fromFileUrl(new URL("../../../..", import.meta.url));

/** Read the project `deno.json` and return its parsed contents. */
export const readConfig = (): { data: Record<string, unknown> } => {
  const raw = Deno.readTextFileSync(join(ROOT, "deno.json"));
  return { data: JSON.parse(raw) as Record<string, unknown> };
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { readConfig };
