# Maker Commands

The `maker` CLI scaffolds source files, drives the database, and runs the dev/build/bundle workflow. Backed by [Cliffy](https://jsr.io/@cliffy/command).

```sh
deno task maker            # list all commands
deno task maker make:module blog
deno task maker db:status
```

## make:* — scaffolding

| Command | Arguments | Options | Creates |
| --- | --- | --- | --- |
| `make:module` | `<name:string>` | `--force` | `src/modules/<name>/` with a barebones model + seeder (plus controller + Zod schema) |
| `make:model` | `<module:string> <name:string>` | `--force`, `--dry-run` | `src/modules/<module>/database/models/<snake>.model.ts` |
| `make:seeder` | `<module:string> <name:string>` | `--force`, `--dry-run` | `src/modules/<module>/database/seeders/<snake>.seed.ts` |
| `make:controller` | `<module:string> <name:string>` | `--force`, `--dry-run` | controller + Zod schema pair in the module's `controllers/` |

After `make:module`, edit the generated model + seeder, then bring the schema to the database:

```sh
deno task maker db:migrate --seed   # or just db:migrate if you don't seed
deno task dev                       # your new bindings appear in the UI
```

`make:model` / `make:seeder` only add extra files to an existing module — migrations apply to the **whole** schema (see [Database Commands](./database.md)).

`--force` overwrites existing files; `--dry-run` prints the target path(s) without writing.

## Example session

```sh
deno task maker make:module blog
#   created  src/modules/blog/database/models/blog.model.ts  (barebones)
#   created  src/modules/blog/database/seeders/blog.seed.ts
#   created  src/modules/blog/controllers/blog.controller.ts + blog.schema.ts

deno task maker make:controller blog Post
#   extra resource: post.controller.ts + post.schema.ts
#   registered in the next bindings:gen
```

## Database family

The `db:*` commands live under the same CLI — see [Database Commands](./database.md).

## Run / build / bundle family

The same CLI drives the run/build/bundle workflow — that's why `deno.json` ships just five thin tasks (`maker`, `dev`, `serve`, `ui`, `test`):

```sh
deno task maker dev            # codegen → build UI → desktop app (HMR)
deno task maker serve          # codegen → deno run -A --env-file src/main.ts
deno task maker build          # build UI + desktop app for the host OS
deno task maker bundle:win     # full package: UI + deps + optional Chromium + zip
```

`dev` / `serve` / `ui` are also mirrored as `deno task dev` / `serve` / `ui`. See [Bundle Commands](./bundle.md) for the bundle flags.