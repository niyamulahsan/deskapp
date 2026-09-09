# Changelog

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