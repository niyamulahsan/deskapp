// ./src/preload.ts

import { contextBridge, ipcRenderer } from "electron";
import { isBindingErrorEnvelope } from "@/core/api/binding-error";

type BindingFn = (...args: unknown[]) => Promise<unknown>;

/**
 * Turn a resolved error envelope (see `@/core/api/binding-error`) back into a
 * rejection, so `try/catch` keeps working and `gum` can read `err.response.data`.
 */
function unwrapBindingResult(result: unknown): unknown {
  if (isBindingErrorEnvelope(result)) {
    const error = new Error(
      typeof result.message === "string" ? result.message : "Binding failed"
    ) as Error & { response?: { status?: number; data: unknown } };
    error.response = {
      status: typeof result.status === "number" ? result.status : undefined,
      data: result
    };
    throw error;
  }
  return result;
}

function setNested(root: Record<string, any>, path: string, fn: BindingFn) {
  const parts = path.split(".");
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!cur[key] || typeof cur[key] !== "object" || typeof cur[key] === "function") cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = fn;
}

try {
  // contextBridge cannot clone/expose a Proxy reliably; expose a concrete object.
  // Supports both forms: bindings['app.window.focus']() and bindings.app.window.focus()
  const names = ipcRenderer.sendSync("deskapp:__list__") as string[];
  const api: Record<string, any> = {};
  for (const name of names) {
    const fn: BindingFn = async (...args: unknown[]) =>
      unwrapBindingResult(await ipcRenderer.invoke(`deskapp:${name}`, ...args));
    api[name] = fn; // flat, backward-compatible
    setNested(api, name, fn); // nested short form
  }
  // Fallback invoker for any name not in the static list.
  api.__invoke = (name: string, ...args: unknown[]) =>
    ipcRenderer.invoke(`deskapp:${name}`, ...args).then(unwrapBindingResult);

  // `md` = module calls (short alias). `bindings` kept for compatibility.
  contextBridge.exposeInMainWorld("md", api);
  contextBridge.exposeInMainWorld("bindings", api);
  console.log(`[preload] module bridge ready (${names.length} handlers) as \`md\`/\`bindings\``);
} catch (err) {
  console.error("[preload] failed to expose bindings", err);
}
