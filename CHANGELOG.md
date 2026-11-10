# Changelog

## [1.2.4] - 2026-11-11

### Fixed
- **Menu/tray/context menu fixes** - Resolved issues with app menu, context menu, and tray menu not working properly.
- **Icon path fixes** - Corrected icon paths.

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
