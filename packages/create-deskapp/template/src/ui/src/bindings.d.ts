/**
 * bindings.d.ts - types the Electron `bindings` global exposed by preload.
 *
 * `bindings` is a Proxy: any `bindings.<name>` access yields a function that
 * invokes `deskapp:<name>` in the main process via IPC and returns a Promise.
 * Backend controllers register handlers under `<module>.<controller>.<handler>`
 * (see src/core/api/registry.ts).
 */

export interface Bindings {
  [name: string]: (...args: unknown[]) => Promise<unknown>;
}

declare global {
  const bindings: Bindings;
}
