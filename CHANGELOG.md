# Changelog

## [1.2.6] - 2026-11-17

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
- **Bindings: thrown errors now survive Electron IPC** - `bindAll` catches a handler throw and returns a tagged error envelope (`src/core/api/binding-error.ts`); the preload bridge rethrows it as an `Error` carrying `.response.data`. Electron's `ipcRenderer.invoke` drops every custom property of a thrown value — a `validate.run` 422 arrived as `Error("Error invoking remote method '…': [object Object]")` — so `form.errors.<field>` never populated under the `bindings` transport. It does now, `try/catch` still works, and `gum.normalizeValidationErrors` unwraps the nested zod `flatten()` output (`errors.fieldErrors` / `errors.formErrors`, plus top-level, flat maps and raw `error.issues`) into per-field messages. New `src/core/api/binding-error.test.ts` and an extended `registry.test.ts` cover it.
- **Pinia was never installed** - `src/ui/src/app.ts` mounted the app with Pulse, Gum and the router but never called `createPinia()`, so the shipped example store (`src/ui/src/stores/example.ts`, `defineStore(...)`) threw `getActivePinia() was called but there was no active Pinia` the moment any component used it. `app.ts` now installs Pinia before mounting, and `guide/ui.md` / `guide/gum.md` / `template/AGENTS.md` document the store pattern and how to call a backend binding from a store (gum's `useGum()` reads the router, so a store should call `bindings[...]` directly or pass a `fetcher`).
- **`template/AGENTS.md`: framework-repo step removed** - The pre-done checklist told the *user's* coding agent to "add a `CHANGELOG.md` bullet under the current version and update the matching `packages/docs/**` page". Those paths are the framework repo's, not the scaffolded app's, so the instruction was nonsense in a user project. Step 4 is gone; the checklist now ends at the in-project checks.

### Changed
- **Docs: `guide/gum.md` corrected to the real gum** - Removed the non-existent `GumRequestError` class and `invokeHttp` helper; switched `useGumForm` to `useGum(defaults).form` (the former is deprecated); documented the transport as auto-detected (`"bindings"` when the Electron bridge is present, else `"http"`) instead of a fixed `"bindings"` default; corrected `progress` (0–100 upload progress, `null` when the size is unknown) and DataTable `disabled` (disables the selection checkboxes, not "while loading"); noted `DataTableSkeleton` `col`/`row` default to `1`.
- **Docs: Pinia, document head & offline** - `guide/ui.md` gains "App plugins: state & document head" (`createPinia()` + `useHead`) and "Offline & online" (the `bindings` transport is in-process and works offline; gum `"http"` and Pulse need the network and neither is `navigator.onLine`-aware). `guide/realtime.md` gains "Realtime in a Pinia store" and "Offline & reconnects"; `guide/gum.md` documents submitting through a store action via the `*With` `fetcher` variants. `template/AGENTS.md` §1/§10/§11 updated to match.
- **Every source file opens with its location header** - Deskapp now follows the nexwire convention: line 1 is `// ./<path-from-project-root>` (e.g. `// ./src/modules/blog/controllers/post.controller.ts`), then one blank line; a Vue SFC uses the HTML form (`<!-- ./src/ui/src/pages/dashboard/index.vue -->`). This reverses the old "no location headers" rule. `template/AGENTS.md` §0.7, §1–§6 and §14–§15 carry it, `maker` writes it on every file it scaffolds, and both generated files emit it from their generators (`src/core/api/generate.manifest.ts`, `src/core/database/aggregate.ts`) so a regeneration reproduces it. All 109 existing `template/src/**` files were retrofitted; the docs examples use the same form.
- **Zod is the single source of truth for input and its type** - Every schema is now paired with its inferred type on the next line — `export type <X>Type = z.input<typeof <X>Schema>` for a request shape (a `.default()` field stays optional), `z.infer` for a response. `make:controller` scaffolds the pair, and `template/AGENTS.md` §1/§4, `guide/conventions.md`, `guide/validation.md` and `api/validate.md` document the `<X>Schema` / `<X>Type` naming and how to import the type instead of re-declaring a body, params or query by hand.
- **DataTable is now "any case", not path-only** - `src/ui/src/components/datatable/index.vue` was locked to one mode: a `path` it fetches itself. It now supports three, matching nexwire — **path mode** (`:path`, unchanged: the table fetches the binding/endpoint and owns its state), **parent-owned mode** (`:data` — the page/store owns the paginate envelope and the table renders it — plus `:fetcher`, which the built-in search/size/page controls call through `gum.getWith`), and **static mode** (`:loop`). A new `:filters` prop is merged into every call so extra query params survive a search or a page change. `path` is now optional (exactly one of `path` / `data` / `loop` is required), the rendered envelope is exposed as `view`, and the self-fetch reload now triggers on `path`/`search` change rather than any tracked dep. `template/AGENTS.md` §11, `guide/gum.md` (new "parent-owned" usage section) and `guide/ai-agents.md` document the modes.
- **`Input` / `Modal` hardening (ported from nexwire)** - `src/ui/src/components/Input.vue` focuses with `preventScroll: true` (a field focused inside a modal no longer scroll-jumps the page), suppresses the character counter for `type="month"` on non-Firefox (there is no month picker to count against), normalizes `category="echallan-number"` to `V<9 digits>`, and reads the new `browserDetect` helper. `Modal.vue` now builds Bootstrap's `Modal` on mount and exposes `open()` / `close()` instead of clicking a hidden button, and `src/ui/src/app.ts` initializes `@unhead/vue` with a `titleTemplate`, so `useHead({ title })` yields `<title> | deskapp` (Electron mirrors it to the window title). `@types/bootstrap` is added as a dev dependency for the Modal types.

### Added
- **`template/AGENTS.md` (ships to scaffolded apps)** - A rich, strict agent contract placed in the template root, so every project scaffolded by `create-deskapp` gets it at the project root. It documents the real Electron-era APIs and conventions — the non-negotiables (never edit `src/core/**`, never hand-edit generated files, directory = meaning, `handlers` map required, facade-only imports, renderer never imports backend), module anatomy, controllers/bindings, schemas/validation, database/pagination, the facade, queue/cron, storage/files, windows/chrome/dialogs/pickers, the `@/ui` alias, gum + DataTable, config, commands, testing, and a pre-done checklist. Modeled on the nexwire agreement and grounded in the real `template/` code; mirrored byte-identically into `packages/create-deskapp/template/AGENTS.md` by `npm run sync:template`.
- **Docs: `llms.txt` + `llms-full.txt`** - The docs site now publishes an agent-readable index (`llms.txt` — every page with a one-line description) and a single-file dump (`llms-full.txt` — every page concatenated), generated from `packages/docs` at build time by `packages/docs/scripts/gen-llms.mjs` (wired as `prebuild`/`predev`, so they cannot drift from the published pages). They land at the site root and are linked from `template/AGENTS.md`.
- **Docs: `guide/conventions.md`** - A reference for deskapp's real conventions: directory = meaning, the discovery table and module tree (no `routes/`, `services/`, `helpers/` or `schemas/` folders; a per-module `facade.ts`), the location header every file opens with, the `@/*` / `@config/*` / `@/ui/*` aliases, the `handlers` map, schemas beside the controller with their inferred `<X>Type`, generated files, the renderer↔backend boundary, and naming.
- **Docs: `guide/testing.md`** - The Vitest setup (real `vitest.config.ts`, aliases, `src/ui/**` excluded), where tests live, scaffolding with `make:test` / `module:make-test`, the facade-mocking pattern, scripts, and coverage guidance (no thresholds shipped by default).
- **Docs: `guide/ai-agents.md`** - Explains the shipped `AGENTS.md` contract, the `llms.txt` / `llms-full.txt` files, and the short rules an agent follows; linked from the guide sidebar.
- **Docs: modifying menus & tray** - `guide/windows.md` gains a "Modifying menus & tray" section naming `src/window/app-menu.ts` (`defaultMenuItems` / `toElectronMenu` / `installAppMenu` / `removeAppMenu`), `src/window/context-menu.ts` (`installContextMenu` / `disableContextMenu`) and `src/window/tray.ts` (`createTray` / `createAppTray` / `createHeadlessTray` / `hideDock`), with the `MenuItem` shape and the `webContents.send("menu-click", id)` contract. `guide/architecture.md` and `guide/ai-agents.md` list these files as app-editable, and `template/AGENTS.md` §0/§1/§9 carve them out of the "do not edit `src/window/**`" rule (§11 now shows `useGum(defaults).form`).
- **`@unhead/vue` — per-page document head & window title** - `src/ui/src/app.ts` now installs `@unhead/vue` (`createHead()` from `@unhead/vue/client`), so any page can call `useHead({ title: "…" })` to set `document.title` (which Electron mirrors to the native window title) and `<meta>`/`<link>` tags, alongside the existing backend `app.window.setTitle` binding. The dependency is added to `package.json` and documented in `guide/ui.md`.
- **Per-module `facade.ts` (cross-module access)** - Each module now has a `facade.ts` at its root — its public API. Other modules import from `@/modules/<m>/facade`, never from a module's `controllers/` or `database/` directly; the facade re-exports the module's controller handlers (each under its own namespace, so two controllers can both export `open` without colliding) and its model(s). A module never imports its own facade and a facade never imports another facade; a Drizzle `relations()` reference to another module's model is the one exception and may import the model file directly. `make:module` scaffolds `facade.ts` (new `stubs/facade/facade.stub`), `make:controller` prints a reminder to re-export the new controller, and the shipped `app` module has one (`template/src/modules/app/facade.ts`). `template/AGENTS.md` §1/§2/§6/§15, `guide/conventions.md`, `guide/modules.md`, `guide/controllers.md`, `guide/architecture.md`, `guide/database.md` and `api/db.md` document it.
- **`InputGroup` & `InputPasswordToggle` components** - `src/ui/src/components/InputGroup.vue` (a paired editable/calculated input pair that reuses the `category` formatters) and `InputPasswordToggle.vue` (a password field with a show/hide toggle), ported from nexwire and available to any page.
- **`browserDetect` plugin** - `src/ui/src/plugins/browserDetect.ts` exposes reactive `isFirefox` / `isChrome` / `isSafari` / `isEdge` / `isOpera` / `isBrave` / `isAndroid` / `isIOS` / `isWindows` / `isMac` flags (and `$browserDetect` via `BrowserDetectPlugin`); `Input.vue` and `InputPasswordToggle.vue` consume it.
- **`routeProgress` helper** - `src/ui/src/plugins/routeProgress.ts` draws a slim top-of-page progress bar; opt in with `setupRouteProgress(router)` in `src/ui/src/router/index.ts` (shipped commented out).

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
