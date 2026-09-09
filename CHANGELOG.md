# Changelog

## [1.0.12] — 2026-09-10

### Fixed

- **The scaffold's source now matches the template exactly.** 1.0.11 only re-bared frontend `npm:` imports, but `deno publish` rewrites every specifier across the whole package — `@std/path` → `jsr:@std/path@^1.1.6`, `@std/http/file-server` → `jsr:/@std/http@^1.1.3/file-server`, and `vite-env.d.ts` got `/// <reference types="npm:/vite@^8.2.2/client" />`. The create script now strips the `jsr:`/`npm:` prefix *and* the version from every `from`/`import`/`declare module`/`/// <reference types>` across **all** scaffold files (the scaffold ships its own `deno.json` imports map, so bare names resolve everywhere), restoring the original source bytes.

### Added

- **Playwright browsers auto-install on first `app.playwright.play`.** `deno install` installs the `playwright` npm package but never the browser binaries, so the demo died with `Executable doesn't exist …/ms-playwright/chromium-<rev>`. Play now detects a missing registry build and downloads it through the *installed* package's own `cli.js` (`ensurePlaywrightBrowserUtils` in `src/core/utils/playwright.ts`) — resolving the local npm package via `import.meta.resolve`, which also avoids the trap of the bare `npm:playwright` specifier resolving to a different cached version and downloading the wrong browser build. Manual fallback (printed on failure): `npx playwright install chromium`.

## [1.0.11] — 2026-09-10

### Fixed

- **Frontend builds with the published template.** The 1.0.10 publish proved `deno publish`'s specifier rewrites now produce *valid* fully-qualified imports (`jsr:@cliffy/command@…`, `npm:vue@^3.5.42`) — so the Deno-side scaffold works — but the **frontend** broke: Vite/Rolldown cannot resolve `npm:` specifiers, it needs bare imports resolved through `node_modules`. The create script now **undoes the `npm:…@version` rewrite for files under `src/ui/`** (restoring `vue`, `bootstrap`, `@vitejs/plugin-vue`, …), so the generated `app.ts`, `pulse.ts`, and `vite.config.ts` build again.

## [1.0.10] — 2026-09-10

### Fixed

- **The real root cause of the relative-import breakage.** `deno publish` automatically rewrites import-map shortcut specifiers into fully-qualified ones ("specifier unfurling"). The package config (`packages/create-deskapp/deno.json`) had no `imports` map — the map only lived in `template/deno.json` — so every bare import in the shipped template (`@cliffy/command`, `@std/…`, `@/…`, `vue`, …) was rewritten from a missing-shortcut state into a broken `./`-prefixed path (e.g. `./@cliffy/command`). The 1.0.7→1.0.9 publications were all re-publishing clean files that *Deno re-broke at publish time*, which is why syncing/scanning the working tree could never catch it. The package now shares the same `imports` map as the template (`@/`/`@/ui/` point into `./template/src/` so the rewrite stays layout-correct), so published specifiers come out fully-qualified (`jsr:@cliffy/command@…`, `npm:vue@…`) or as valid relative paths — and scaffolds work off the registry.

## [1.0.9] — 2026-09-09

### Fixed

- **1.0.8 accidentally shipped the same relative-import breakage.** The published package included a template whose import statements had been rewritten to `./`-prefixed relative paths (e.g. `from "./@cliffy/command"` instead of `from "@cliffy/command"`), so every scaffold inherited `Module not found "…/src/core/maker/@cliffy/command"`. This release re-publishes the clean source template, and `deno task publish` now runs the template sync first — `scripts/sync-template.mjs` re-copies `template/` into the package (wiping any local drift) and **aborts if any file still contains a `./`-prefixed specifier that matches the template's own imports map**, so a dirty package can never be uploaded again.

## [1.0.8] — 2026-09-09

### Fixed

- **Scaffolded projects are runnable again.** The 1.0.7 published template had been rewritten (by an editor "convert to relative imports" pass) so every `@/…`, `@std/…`, `@libsql/client`, and bare npm import (`vue`, `bootstrap`, `bcryptjs`, `socket.io-client`, …) became a broken relative `./…` path — e.g. `import { Command } from "./@cliffy/command"` — which made `deno task dev` fail with `Module not found "…/src/core/maker/@cliffy/command"`. Bare specifiers resolve through the `deno.json` imports map; `./`-prefixed ones never do. 1.0.8 re-publishes the clean source template. `scripts/sync-template.mjs` now **fails the sync** if any packaged file contains a `./`-prefixed specifier that matches the template's own imports map, so a dirty publish cannot happen again.

## [1.0.7] — 2026-09-09

### Fixed

- **`deno create jsr:@niyam/deskapp` works again.** The scaffold script built the JSR base URL with `../../` from the entry module, which strips the version segment — JSR only serves package files (`template.manifest.json`, `template/**`) at the *versioned* package root, so the fetch 404'd with "Could not load template manifest". The base now stays at the versioned root (`../`), so the manifest and every template file download correctly over the registry CDN. This regression was present since the CDN-loading change in 1.0.3.

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