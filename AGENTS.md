# Working Agreement — deskapp

Rules for every code change in this repo — the scaffolded app under `template/`, the npm scaffolder `create-deskapp`, and the docs — regardless of author (human or agent).

## Repo map
- `template/` — the Electron + Vue 3 + TypeScript app that gets scaffolded. **Source of truth** for all framework and app code (window manager, bindings registry, database, queue, scheduler, storage, validation, password, Playwright, maker CLI, and the Vue UI).
- `packages/create-deskapp/` — the published `@niyamulahsan/create-deskapp` package: `bin/create.js` (the scaffolder runtime) plus `template/`, a mirror of `template/`.
- `packages/docs/` — the VitePress docs site (`guide/`, `api/`, `cli/`).
- `scripts/sync-template.mjs` — mirrors `template/` → `packages/create-deskapp/template/` (`npm run sync:template`).

## Versioning & releases
- The **current in-flight release** lives on a named branch, e.g. `release/1.2.6`. Edits are **never** committed straight to `main`.
- Checkpoint often: one commit per verified step. A bad step is rolled back with `git reset --hard <last-good-commit>` — never by hand-fixing forward.
- `main` stays known-good. When the branch is confirmed stable it is merged into `main` (PR or fast-forward) and tagged with the release version; the branch is kept as a rollback point until the release ships.
- The version lives in `packages/create-deskapp/package.json`. Changelog: every user-visible fix gets a bullet under the current version's `### Fixed` / `### Changed` / `### Added` section in `CHANGELOG.md`, with the date in the header (`## [x.y.z] - YYYY-MM-DD`).
- Publish with `npm run publish:cli` (runs `sync:template`, then `npm publish` in `packages/create-deskapp`). Never publish from a dirty tree, and never publish without a matching `CHANGELOG.md` entry.

## Correctness convention: byte-identity between template and scaffolder
- The scaffolder ships a copy of the template, so there is one engine but two homes: `template/…` and `packages/create-deskapp/template/…`. "Fix it once, fix both." After editing anything under `template/`, run `npm run sync:template` and **prove** the mirror matches — compare SHA-256 (`Get-FileHash`) or `fc /b` of the `template/` copy against the `packages/create-deskapp/template/` copy, and include the result in the commit message (e.g. `byte-identical template↔scaffolder (sha …)`).
- `scripts/sync-template.mjs` deliberately transforms a few files. These are **expected** to differ or be absent — say so in the commit message rather than treating them as drift:
  - `.env` / `.env.example` — `DESKAPP_UI=true` is pinned on the synced copies.
  - `.gitignore` — renamed to `gitignore-stub` (npm ignores `.gitignore`).
  - Skipped: lockfiles (`package-lock.json`, `deno.lock`, `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`), build output (`out/`, `release/`, `dist/`, `coverage/`, `src/ui/dist/`), `*.sqlite*` and `*.log` files, and `*.test.ts` / `__tests__` (except `modules/*/__tests__`).
- `packages/create-deskapp/bin/create.js` and `scripts/sync-template.mjs` are the scaffolder's **own runtime** — they are not mirrored from `template/`.
- Docs (`packages/docs/**`) are separate and never part of a scaffolded app, but every path, env var, CLI command, and API signature they show must match the code exactly.

## The fix loop (follow for every change)
1. **Find the root cause** in `template/…` (the source of truth) — not in the mirror and not in the docs.
2. **Edit the fix** in `template/…`.
3. **Mirror**: run `npm run sync:template`, then confirm the synced copy is byte-identical — or is one of the documented exceptions above.
4. **Verify** with a clean grep/read (no accidental hash-paste loops): show the changed lines.
5. **Changelog**: add the bullet now, under the current release version. This is where bugs are audited, so it's non-negotiable.
6. **Docs**: update the relevant page(s) under `packages/docs/**` in the same change; keep every config/env/API reference consistent with the code.
7. **Commit** on the release branch with a descriptive message, including the byte-identity proof.
8. **Push** the branch (`git push`, tracking is set). `main` untouched.
9. When the whole release is confirmed stable → merge to `main` + tag via the release process.

## Working-tree hygiene
- `main` is sacred: only confirmed-stable merges land there.
- Don't fold unrelated edits into a checkpoint commit; keep them separate.
- LF/CRLF: Git reports "LF will be replaced by CRLF" for some files — that's benign (`core.autocrlf true`), don't let it derail a commit.

## Testing before "done"
- In `template/` (and therefore in any scaffolded app): `npm run lint` (Biome) and `npm test` (Vitest — `src/**/*.test.ts`, Node environment).
- Docs: `npm run docs:build`. VitePress fails the build on dead links, so a green build is the docs check.
- If a change can't be exercised by the above, at minimum re-run the template↔scaffolder byte-identity proof and a smoke read of the touched files.
