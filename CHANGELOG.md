# Changelog

## [1.0.6] — 2026-09-09

### Added

- **Live UI reload in `deno task dev`.** Dev now builds the frontend in watch mode (`vite build --watch`) and sets `FRONTEND_WATCH=1`; the backend polls `src/ui/dist` via the new `win.watchFrontend(dist, onChange)` on the `win` facade and reloads the open window when a rebuild lands. SCSS, Vue template, and SFC `<style>` edits all appear without a manual refresh.

### Changed

- **Frontend entry renamed** `src/ui/src/main.ts` → `src/ui/src/app.ts`. **Bootstrap 5** (CSS + JS bundle) and **Bootstrap Icons** are now imported by default in `app.ts`, and the webview favicon lives in the UI (`src/ui/src/assets/images/favicon/favicon.ico`) instead of the project-root icon folder.

### Fixed

- **`win.watchFrontend` only watched top-level `dist` entry names**, which never change during a Vite rebuild (hashed assets live under `dist/assets/`) — so it could never fire. It now signs the whole `dist` tree plus `index.html` and fires once the rebuilt state settles.

## [1.0.4] — 2026-09-09

### Fixed

- **README no longer presents `app.*` as the framework API.** The facade (`@/core/facade.ts`) exposes per-capability namespace objects — `win`, `chrome`, `pickers`, `db`, `queue`, `cron`, `storage`, … — while `app.*` is only the prefix of the *sample* module's UI bindings (`bindings['<module>.<controller>.<handler>']()`), which developers replace with their own modules. Quick Start now shows real facade usage instead of invented `app.*` examples.

## [1.0.3] — 2026-09-08

### Fixed

- **`deno create` now actually scaffolds.** `deno create` executes `./create` from the JSR registry (the module runs from an `https://jsr.io/...` URL, not a local path), so the old template loading from disk crashed with `The URL must be of scheme file`. The template is now shipped with a file manifest (`template.manifest.json`) and downloaded over the JSR CDN when running remotely; local repo checkouts still read `template/` from disk.

## [1.0.0] — 2026-09-08

Initial release.

### Added

- **deskapp framework** — batteries-included desktop framework on Deno: facade namespaces (`win`, `chrome`, `pickers`, `db`, `queue`, `cron`, `storage`), window manager with native chrome, window-bound controller bindings, private/public/tmp storage, SQLite + Drizzle ORM, queue, cron scheduler, Zod validation, password hashing, Playwright automation, and a Vue 3 + Vite UI.
- **`deno create` scaffolding** — `deno create jsr:@niyam/deskapp` scaffolds the full starter project into the current folder, materializes `.gitignore` and `.env`, and prints next steps.
- **Maker CLI** — code generation for modules, controllers, models, and seeds; schema/migration/seed management, UI dev server, and per-OS binary bundling.
- **Dark dashboard starter UI** — topbar, hero, subsystem cards, and a live action console; a lean custom SCSS theme (Public Sans + `--dk-*` design tokens) replaces the compiled Bootstrap bundle.
- **Monorepo layout** — `packages/create-deskapp` (published template + `./create` script), `packages/docs` (VitePress site), `scripts/sync-template.mjs` (syncs the live `template/` into the package), `logo-favicon/`, CI for docs deployment.
- **Third-party documentation** — guide (architecture, modules, controllers, windows, database, storage, UI, queue, scheduler, validation, password, Playwright, testing), CLI reference, and a distribution/deploy guide.
- **Brand assets in docs** — the full `logo-favicon` set is wired into the VitePress site: favicon (svg/ico/png), web manifest, apple-touch icon, navbar logo, and an index-hero image styled like the nexgen docs.