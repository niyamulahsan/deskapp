// ./src/modules/app/facade.ts

/**
 * Public API for the app module.
 *
 * The sample module ships six controllers and no model. Each controller is
 * re-exported under its own namespace, so other modules can call it without
 * reaching into `controllers/` directly:
 *
 *   import { app } from "@/modules/app/facade";
 *   const rows = app.demo.table({ page: 1 });
 *
 * Rules: a module never imports its own facade; a facade never imports another
 * facade.
 */

export * as auth from "./controllers/auth.controller";
export * as demo from "./controllers/demo.controller";
export * as net from "./controllers/net.controller";
export * as playwright from "./controllers/playwright.controller";
export * as storage from "./controllers/storage.controller";
export * as window from "./controllers/window.controller";
