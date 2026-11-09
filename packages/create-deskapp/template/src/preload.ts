import { contextBridge, ipcRenderer } from "electron";

type BindingFn = (...args: unknown[]) => Promise<unknown>;

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
    const fn: BindingFn = (...args: unknown[]) => ipcRenderer.invoke(`deskapp:${name}`, ...args);
    api[name] = fn; // flat, backward-compatible
    setNested(api, name, fn); // nested short form
  }
  // Fallback invoker for any name not in the static list.
  api.__invoke = (name: string, ...args: unknown[]) => ipcRenderer.invoke(`deskapp:${name}`, ...args);

  // `md` = module calls (short alias). `bindings` kept for compatibility.
  contextBridge.exposeInMainWorld("md", api);
  contextBridge.exposeInMainWorld("bindings", api);
  console.log(`[preload] module bridge ready (${names.length} handlers) as \`md\`/\`bindings\``);
} catch (err) {
  console.error("[preload] failed to expose bindings", err);
}