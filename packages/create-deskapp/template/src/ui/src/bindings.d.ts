/**
 * bindings.d.ts - types the Deno Desktop `bindings` global in the webview.
 *
 * `bindings` is a Proxy: any `bindings.<name>` access yields a function that
 * calls into the Deno backend in-process and returns a Promise. Backend
 * controllers register handlers under `<module>.<controller>.<handler>` (see
 * src/core/api/registry.ts). Because names are dynamic and auto-discovered,
 * every access is typed with a single callable signature - no per-binding
 * entries need to be maintained here.
 */

export interface Bindings {
  [name: string]: (...args: unknown[]) => Promise<unknown>;
}

declare global {
  const bindings: Bindings;
}

export {};
