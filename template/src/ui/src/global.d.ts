/// <reference types="vite/client" />

/**
 * Globals for untyped dependencies.
 *
 * - `*.vue`: single-file components resolved by @vitejs/plugin-vue; declare
 *   them here so arbitrary `.vue` imports type-check.
 * - `lodash-es`: ships without types; only a few helpers are imported, so we
 *   declare just those.
 *
 * NOTE: keep this file a global *script* (no top-level import/export).
 * Adding `export {}` turns `declare module` into module augmentation, which
 * requires the target module to already have types and breaks these shims.
 */

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "lodash-es" {
  export function debounce<T extends (...args: any[]) => any>(fn: T, wait?: number): T;
  export function throttle<T extends (...args: any[]) => any>(fn: T, wait?: number): T & {
    cancel: () => void;
    flush: () => void;
  };
}

declare module "luxon";
declare module "bootstrap/js/dist/toast.js";