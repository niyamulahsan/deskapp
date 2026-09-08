# create-deskapp

Scaffold a new **deskapp** desktop project (Deno Desktop + Vue 3).

## Usage

```sh
deno create jsr:@niyam/deskapp my-app
cd my-app
deno install
deno task dev
```

Requires **Deno 2.4+**.

## How it works

`deno create` downloads this package and runs its `./create` entry
(`src/index.ts`). The scaffold content ships in `template/` — a clean sync of
the repository's live `template/` produced by
[`scripts/sync-template.mjs`](../../scripts/sync-template.mjs).

The create script:

1. Copies `template/` into `./<project-name>`.
2. Renames `gitignore-stub` → `.gitignore` (JSR never packs a real `.gitignore`).
3. Writes `.env` from `.env.example`.
4. Renames the app (`deno.json` → `desktop.app.name`).
5. Prints next steps.

## Development

```sh
npm run sync:template   # copy ../../template -> ./template (skips node_modules/dist/locks)
cd ../.. && npm run publish:cli
```