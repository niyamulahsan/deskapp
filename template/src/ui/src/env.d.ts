/// <reference types="vite/client" />

declare const md: any & {
  __invoke: (name: string, ...args: unknown[]) => Promise<unknown>;
  [key: string]: any;
};
/** @deprecated alias for `md` (kept for compatibility) */
declare const bindings: typeof md;

interface Window {
  md: typeof md;
  bindings: typeof bindings;
}
