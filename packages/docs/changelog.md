# Changelog

## [1.2.6] - 2026-11-16

### Fixed
- **Scaffolder: sample tests now ship** - `scripts/sync-template.mjs` filtered out the `modules/*/__tests__` directory before it could keep the test files inside it, so scaffolded projects had no tests and `npm test` failed with "No test files found". The filter now mirrors `modules/*/__tests__` (the framework's own `*.test.ts` are still excluded).
- **Docs: Deno-era drift removed** - `guide/ui.md`, `guide/quick-start.md`, `guide/modules.md`, and `cli/maker.md` no longer describe `serveDir`, `deno task`, `deno.json`/import maps, `FRONTEND_WATCH`, `resolveDistPath`, `bundle:win --ui=`, or `npx deskapp`; they now describe the Electron build (`vite` + esbuild + electron-builder, `loadFile(src/ui/dist/index.html)`, `npm run maker`).
- **Docs: window preset path** - Every reference to `src/window/config.ts` corrected to `src/config/winsetup.ts` (the real preset map; `src/window/config.ts` is a back-compat re-export) across `guide/{windows,configuration,architecture,recipes,ui}.md` and `api/win.md`.
- **Docs: storage API** - `guide/storage.md`, `guide/recipes.md`, and `api/storage.md` now use `storage.put`/`storage.get` and `storage.disk("private"|"tmp").path(...)` instead of the non-existent `storage.getAppDataDir()`/`getTmpDir()`, and document the real root (`<userData>/storage`; CLI/dev fallback `<project>/src/storage/app`).
- **Docs: chrome/dialogs API** - Removed the non-existent `chrome.promptDialog` and `chrome.defaultContextMenuItems`; documented that `confirmDialog`/`alertDialog` are async and are also exported at the facade top level.
- **Docs: queue & scheduler API** - `guide/{queue,recipes}.md` and `api/index.md` now show `queue.create({ concurrency })` then `q.add(fn)` (no global `queue.add`/`queue.process`) and `cron.schedule(name, expr, fn, { timezone })` with a handle `.stop()` (and `cron.stop()` for all).
- **Docs: Chromium resolve** - `chromium.resolve()` documented as synchronous (returns `string | undefined`) in `guide/recipes.md` and `api/chromium.md`.
- **Docs: pickers, database, bindings** - Pickers now describe Electron's `dialog` module + the `"Name|pattern"` filter syntax; `guide/database.md` documents the real default SQLite path; `guide/controllers.md` points at `src/ui/src/bindings.d.ts` and the `md` alias.
- **Docs: paginate example** - Fixed a self-shadowing `const users = await paginate.model(...)` in `api/paginateModel.md`.
- **Docs: broken anchor** - `guide/storage.md` → `guide/windows.md#file-pickers` now resolves.
- **`template/.env.example`** - The realtime comment no longer claims a "local realtime" stack; Pulse is a client that connects out to a server engine.

### Added
- **`template/AGENTS.md` (ships to scaffolded apps)** - A rich, strict agent contract placed in the template root, so every project scaffolded by `create-deskapp` gets it at the project root. It documents the real Electron-era APIs and conventions — the non-negotiables (never edit `src/core/**`, never hand-edit generated files, directory = meaning, `handlers` map required, facade-only imports, renderer never imports backend), module anatomy, controllers/bindings, schemas/validation, database/pagination, the facade, queue/cron, storage/files, windows/chrome/dialogs/pickers, the `@/ui` alias, gum + DataTable, config, commands, testing, and a pre-done checklist. Modeled on the nexwire agreement and grounded in the real `template/` code; mirrored byte-identically into `packages/create-deskapp/template/AGENTS.md` by `npm run sync:template`.
- **Docs: `llms.txt` + `llms-full.txt`** - The docs site now publishes an agent-readable index (`llms.txt` — every page with a one-line description) and a single-file dump (`llms-full.txt` — every page concatenated), generated from `packages/docs` at build time by `packages/docs/scripts/gen-llms.mjs` (wired as `prebuild`/`predev`, so they cannot drift from the published pages). They land at the site root and are linked from `template/AGENTS.md`.
- **Docs: `guide/conventions.md`** - A reference for deskapp's real conventions: directory = meaning, the discovery table and module tree (no `routes/`, `services/`, `helpers/`, `schemas/` or per-module `facade.ts`), no location headers, the `@/*` / `@config/*` / `@/ui/*` aliases, the `handlers` map, schemas beside the controller, generated files, the renderer↔backend boundary, and naming.
- **Docs: `guide/testing.md`** - The Vitest setup (real `vitest.config.ts`, aliases, `src/ui/**` excluded), where tests live, scaffolding with `make:test` / `module:make-test`, the facade-mocking pattern, scripts, and coverage guidance (no thresholds shipped by default).
- **Docs: `guide/ai-agents.md`** - Explains the shipped `AGENTS.md` contract, the `llms.txt` / `llms-full.txt` files, and the short rules an agent follows; linked from the guide sidebar.

## [1.2.5] - 2026-11-11

### Fixed
- **Realtime auth** - The Pulse client now sends the access token through the Socket.IO handshake (`auth` callback) instead of relying on an httpOnly cookie the Electron webview cannot set. After `pulse.setToken(...)`, the engine authenticates the socket and auto-joins `user:{id}`, `role:{role}`, and `auth` rooms; previously the socket stayed a guest even when signed in.
- **`pulse.setToken()`** - Accepts a token string, `null`, or a getter (resolved on every reconnect). Calling it while connected re-handshakes and re-joins all tracked rooms, and the `__SOCKET_ENABLED__ = false` no-op client implements it too.
- **`pulse.leave()`** - Now emits `leave` to the engine before dropping listeners, so the socket actually unsubscribes from the room; previously it only removed local listeners and kept receiving that room's events. Room names are trimmed consistently.

### Changed
- **Docs** - `guide/realtime.md` and `guide/ui.md` document handshake-token auth, the updated `pulse.ts` source, and room-join authorization: public rooms and the socket's own `user:<id>` / `private:user:<id>` are accepted, everything else is refused with `join:error`.

## [1.2.4] - 2026-11-11

### Fixed
- **Menu/tray/context menu fixes** - Resolved issues with app menu, context menu, and tray menu not working properly.
- **Icon path fixes** - Corrected icon paths.

## [1.2.3] - 2026-11-10

### Changed
- **Docs improvements** - Added changelog to sidebars, improved windows/menus/dialogs/tray documentation with winsetup config details, fixed Deno references.
- **Database/schema fixes** - Fixed schema generation to avoid .ts extensions, fixed ESM/CommonJS require issues in database connection.
- **Template fixes** - Updated create command to use scoped package name.

## [1.2.2] - 2026-11-10

### Changed
- **Docs and configuration updates** - Improved documentation for windows, menus, dialogs, pickers, and app configuration. Added winsetup/config details.

## [1.2.1] - 2026-11-10

### Changed
- **Package name changed to scoped** - Published as `@niyamulahsan/create-deskapp`. Use `npm create @niyamulahsan/deskapp@latest`.
- **Updated README badges and documentation** - Added badges and corrected package references.

### Added
- **Migrated to Electron + npm** - Replaced Deno Desktop with Electron. Build system now uses esbuild, Vite, and electron-builder.
- **Switched scaffolding to npm-only** - Deno/JSR publishing deprecated.
- **Maker CLI updated for Node.js** - CLI and stubs adapted for Node/Electron environment.
- **Documentation rewritten for Electron** - All docs updated with Electron/npm workflows and comprehensive examples.
- **New `md` bindings API** - Call bindings as `md.module.controller.handler()` alongside `bindings[]` form.
- **Comprehensive recipes & guides** - Added detailed examples for dialogs/pickers, windows/menus/tray, queue/scheduler, Playwright automation, file operations, Excel/CSV/PDF, audio/video streaming.
- **Improved sync tooling** - Enhanced template sync with env pinning, sanitization, and better filtering.

### Deprecated
- **Deno/JSR distribution** - No longer maintained. Migrate to npm/Electron version.

## [1.0.13] - 2026-09-11

### Fixed
- **The bundled-app marker is a file.** `.deno-desktop-app` is created as a *file* beside the compiled exe, not a directory; the base-dir detection accepts either, and a packaged app anchors `DATABASE_URL`/storage/base dirs to the executable directory even when launched from a foreign working directory.

### Added
- **Docs:** `gum.md` now states the HTTP verb is advisory under the `bindings` transport ??? the URL is the binding name; the method only picks which option slot the handler receives (`query` vs `data`), so `gum.post('...destroyAll', { ids })` and `gum.delete('...destroyAll', { query: { ids } })` call the same handler with the same object. `ui.md`'s reference `vite.config.ts` matches the shipped `fileURLToPath` version and explains the `.pathname` percent-encoding trap.
