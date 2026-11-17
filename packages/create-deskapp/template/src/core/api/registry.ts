import { ipcMain } from "electron";
import { toBindingErrorEnvelope } from "@/core/api/binding-error";
import { GENERATED_CONTROLLERS } from "@/core/api/bindings.generated";

/** A callable handler registered for the frontend. */
export type BoundHandler = (...args: unknown[]) => unknown;

/** A controller module exposing a `handlers` map for registration. */
interface ControllerModule {
  handlers?: Record<string, BoundHandler>;
}

/**
 * Collect every registered handler across modules, keyed by
 * `<module>.<controller>.<handler>` (e.g., `auth.role.index`).
 */
export function collectHandlers(): Map<string, BoundHandler> {
  const handlers = new Map<string, BoundHandler>();

  for (const entry of GENERATED_CONTROLLERS) {
    const mod = entry.mod as ControllerModule;
    if (!mod.handlers) continue;
    for (const key of Object.keys(mod.handlers)) {
      handlers.set(`${entry.module}.${entry.controller}.${key}`, mod.handlers[key]);
    }
  }

  return handlers;
}

/**
 * Register all handlers with Electron's ipcMain.
 * In Electron, we don't bind to a specific window; we bind globally.
 */
export function bindAll(): void {
  const handlers = collectHandlers();
  for (const [name, fn] of handlers) {
    ipcMain.handle(`deskapp:${name}`, async (_event, ...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        // Electron drops a thrown value's properties across IPC (only a string
        // message survives), so return a tagged envelope the preload bridge
        // turns back into a rejection. See `@/core/api/binding-error`.
        return toBindingErrorEnvelope(error);
      }
    });
  }
  // Sync channel so preload can expose a concrete, cloneable bindings object.
  ipcMain.removeHandler?.("deskapp:__list__" as never);
  ipcMain.on("deskapp:__list__", (event) => {
    event.returnValue = [...handlers.keys()];
  });
  ipcMain.handle("deskapp:__list__", async () => [...handlers.keys()]);
  console.log(`[bindings] registered ${handlers.size} IPC handler(s)`);
}
