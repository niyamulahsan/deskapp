// ./src/ui/src/env.d.ts

/// <reference types="vite/client" />
/// <reference path="./bindings.d.ts" />

declare const md: any & {
  __invoke: (name: string, ...args: unknown[]) => Promise<unknown>;
  [key: string]: any;
};
/** @deprecated alias for `md` (kept for compatibility) */
// declare const bindings: typeof md;

interface Window {
  md: typeof md;
  bindings: typeof bindings;
}
