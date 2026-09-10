import { fromFileUrl, toFileUrl } from "@std/path";
import { GENERATED_CONTROLLERS } from "@/core/api/bindings.generated.ts";

/**
 * registry.ts - desktop bindings registry.
 *
 * Collects every module's `controllers/*.controller.ts` handlers map and binds
 * each function onto a Deno Desktop BrowserWindow so the frontend can call it
 * in-process via `bindings.<name>()` (no HTTP/IPC).
 *
 * The controller list comes from the generated manifest
 * `bindings.generated.ts` (produced by `deno task maker bindings:gen`), because at
 * runtime the packaged binary's filesystem cannot be scanned. The old
 * filesystem walk is kept only as a fallback for a stale/missing manifest.
 *
 * Binding names are namespaced as `<module>.<controller>.<handler>`
 * (e.g. `userarea.userarea.index` or `auth.role.store`).
 */

const SRC_PATH = fromFileUrl(new URL("../..", import.meta.url));

/** Recursively collect controller files under a directory (if it exists). */
function walkControllers(dir: string, out: string[]): void {
  try {
    for (const entry of Deno.readDirSync(dir)) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory) {
        walkControllers(full, out);
      } else if (entry.isFile && entry.name.endsWith(".controller.ts")) {
        out.push(full);
      }
    }
  } catch {
    // directory does not exist - skip
  }
}

/** Derive `{ module, controller }` names from a controller file path. */
function namesOf(file: string): { module: string; controller: string; } {
  const rel = file.replace(SRC_PATH + "/", "").replace(/\\/g, "/");
  const root = rel.startsWith("core/") ? "core" : "modules";
  const parts = rel.slice(root.length + 1).split("/");
  // modules/<module>/controllers/<name>.controller.ts
  return { module: parts[0], controller: parts[2].replace(/\.controller\.ts$/, "") };
}

/** Discover every controller file across modules and core areas. */
function discoverControllerFiles(): string[] {
  const files: string[] = [];
  for (const moduleDir of Deno.readDirSync(`${SRC_PATH}/modules`)) {
    if (!moduleDir.isDirectory) continue;
    walkControllers(`${SRC_PATH}/modules/${moduleDir.name}/controllers`, files);
  }
  for (const areaDir of Deno.readDirSync(`${SRC_PATH}/core`)) {
    if (!areaDir.isDirectory) continue;
    walkControllers(`${SRC_PATH}/core/${areaDir.name}/controllers`, files);
  }
  return files.sort();
}

/** A callable handler registered for the frontend. */
export type BoundHandler = (...args: unknown[]) => unknown;

/** The minimal window surface required to accept bound handlers. */
export interface BindableWindow {
  bind(name: string, handler: (...args: unknown[]) => unknown): void;
}

/** A controller module exposing a `handlers` map for registration. */
interface ControllerModule {
  handlers?: Record<string, BoundHandler>;
}

/**
 * Collect every registered handler across modules, keyed by
 * `<module>.<controller>.<handler>` (e.g. `auth.role.index`).
 */
export async function collectHandlers(): Promise<Map<string, BoundHandler>> {
  const handlers = new Map<string, BoundHandler>();

  let files: string[] = [];
  if (GENERATED_CONTROLLERS.length > 0) {
    for (const entry of GENERATED_CONTROLLERS) {
      const mod = entry.mod as ControllerModule;
      if (!mod.handlers) continue;
      for (const key of Object.keys(mod.handlers)) {
        handlers.set(`${entry.module}.${entry.controller}.${key}`, mod.handlers[key]);
      }
    }
    return handlers;
  }

  // Fallback: scan the source tree (dev only, when the manifest is stale).
  files = discoverControllerFiles();
  for (const file of files) {
    const mod = (await import(toFileUrl(file).href)) as ControllerModule;
    if (!mod.handlers) continue;
    const { module, controller } = namesOf(file);
    for (const key of Object.keys(mod.handlers)) {
      handlers.set(`${module}.${controller}.${key}`, mod.handlers[key]);
    }
  }

  return handlers;
}

/**
 * Bind every discovered handler onto a Deno Desktop BrowserWindow. Call this
 * once per window (using the docs' "adopt the startup window" pattern).
 *
 * Handlers are wrapped so every injected function is awaited as a Promise,
 * matching the desktop `bind` contract regardless of whether the source
 * handler is declared sync or async.
 */
export async function bindAll(win: BindableWindow): Promise<void> {
  const handlers = await collectHandlers();
  for (const [name, fn] of handlers) {
    win.bind(name, async (...args: unknown[]) => await fn(...args));
  }
  console.log(`[bindings] bound ${handlers.size} handler(s)`);
}
