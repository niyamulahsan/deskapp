# Database Commands

All database operations are `db:*` subcommands of the maker CLI (from `src/core/maker/db/`). They wrap Drizzle Kit and the app's own migration/seeding pipeline.

```sh
deno task maker db:status
```

## From model to table — the actual workflow

`deno task maker make:module <name>` already creates a **barebones model + seeder** (plus a controller + Zod schema) in `src/modules/<name>/`. So you rarely write files by hand — you shape what was generated:

```sh
deno task maker make:module blog
# edit src/modules/blog/database/models/blog.model.ts   <- shape your table
# edit src/modules/blog/database/seeders/blog.seed.ts   <- optional demo rows
deno task maker db:migrate --seed   # create & apply migrations, then seed
```

`make:model` / `make:seeder` are only needed when you add **extra** models/seeders to an existing module.

> [!IMPORTANT] `db:migrate` is whole-schema; `db:migrate:module` is per-module
> `db:schema` aggregates *all* models under `src/modules/**/database/models/*.model.ts` into `src/database/schema.ts`, and `db:migrate` diffs the **entire** schema against the database. To migrate **one module** in isolation — its models only — use `db:migrate:module <name>` (see below). Seeding is per-module via `db:seed --module=<name>`, because seeders are plain scripts.

## Command reference

| Command | What it does | Notes |
| --- | --- | --- |
| `db:schema` | Regenerate `src/database/schema.ts` from all models | run after adding/changing a model |
| `db:generate` | Regenerate schema **and** create migration SQL files | does not apply them |
| `db:migrate` | Generate + run migrations, then apply model hooks | `--seed` also runs seeders |
| `db:migrate:run` | Run existing migrations + model hooks | no generate, no seed |
| `db:migrate:module` | Generate + run migrations for **one module's** models | `<module>` argument; `--keep-temp` keeps the temp schema |
| `db:fresh` | **Delete the database file**, then generate + migrate + hooks | `--seed` also seeds |
| `db:reset` / `db:wipe` | Delete the SQLite database file **only** | destructive; they are aliases |
| `db:status` | List generated migration files | |
| `db:seed` | Run all seeders (auto FK-ordered) | `--module <name>` seeds one module |
| `db:push` | Push the schema directly (Drizzle Kit `push`) | dev convenience, no migration files |
| `db:check` | Drizzle Kit `check` — validate migrations vs schema | |
| `db:studio` | Open Drizzle Studio GUI | |

## `db:migrate` vs `db:fresh` — when to use which

| | `db:migrate [--seed]` | `db:fresh [--seed]` |
| --- | --- | --- |
| Database | keeps existing data | **deletes the database file first** |
| What runs | generate migrations → apply → hooks → (seed) | reset → generate → apply → hooks → (seed) |
| Use it | every normal change: new module, new column, tweaked model | clean slate: heavy reshuffle, deleted old migrations, fresh checkout |

Because `db:migrate` never drops data, it is the everyday command. Reach for `db:fresh` when the database should be rebuilt from zero — it is `db:reset` followed by the full `db:migrate` flow.

> [!WARNING] `db:migrate` refuses to run if it would create the *initial* migration while the database already contains tables — a sign the migration files were deleted but the DB file survived. Fix it with `deno task maker db:fresh --seed` (rebuild locally) or restore the migration files.

## Migrate a single module

`db:migrate:module <name>` migrates only the models in `src/modules/<name>/database/models/` — everything else stays untouched. Use it to ship one module's schema on its own, e.g. in CI, or for a module that was added later:

```sh
deno task maker db:migrate:module blog
```

Under the hood it writes a temporary schema (re-exporting just that module's models), runs `drizzle-kit generate` + `migrate` against it via the `DRIZZLE_SCHEMA` override, then cleans up the temp file. Use `--keep-temp` to keep the temp schema for inspection:

```sh
deno task maker db:migrate:module blog --keep-temp
```

This pairs with per-module seeding (`db:seed --module=blog`): so both migrations and seeders can be scoped to a single module.

## Seeding

- `db:migrate --seed` / `db:fresh --seed` — run seeders as part of the flow (the common case).
- `db:seed` — run all seeders on their own, auto-ordered by FK.
- `db:seed --module=blog` — seed only one module's seeders.

## `db:reset` / `db:wipe` — the blunt instruments

Both delete the SQLite database file **and nothing else**: no schema, no migrations, no rebuild. If you reset, the next `db:migrate` (or `db:fresh`) regenerates everything. `db:fresh` is the same reset plus a full migrate — so anything you can do to recover from a `db:reset` you get automatically from `db:fresh --seed`.

## Typical flows

**Add a new module (model + seeder), ship the migration:**

```sh
deno task maker make:module blog
# edit src/modules/blog/database/models/blog.model.ts
deno task maker db:migrate --seed
```

**Add an extra model to an existing module:**

```sh
deno task maker make:model blog Comment --force
# edit src/modules/blog/database/models/comment.model.ts
deno task maker db:migrate
```

**Fresh slate with seed data (dev):**

```sh
deno task maker db:fresh --seed
```

**Seed only one module:**

```sh
deno task maker db:seed --module=blog
```

## Environment

The DB file lives at `DATABASE_URL` (default `sqlite:./src/storage/deskapp.sqlite`). Keep `src/storage/` out of git — the starter's `.gitignore` already does.