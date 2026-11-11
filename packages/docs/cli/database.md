# Database Commands

All database operations are `db:*` subcommands of the maker CLI.

```sh
npm run maker db:status
```

## Commands

| Command                | What it does                                              | Notes                              |
| ---------------------- | --------------------------------------------------------- | ---------------------------------- |
| `db:schema`            | Regenerate `src/database/schema.ts` from all models       | run after adding/changing a model  |
| `db:generate`          | Regenerate schema and create migration SQL files          | does not apply them                |
| `db:migrate`           | Generate + run migrations, then apply model hooks         | `--seed` also runs seeders         |
| `db:migrate:run`       | Run existing migrations + model hooks                     | no generate, no seed               |
| `db:fresh`             | Delete the database file, then generate + migrate + hooks | `--seed` also seeds                |
| `db:reset` / `db:wipe` | Delete the SQLite database file only                      | destructive                        |
| `db:status`            | List generated migration files                            |                                    |
| `db:seed`              | Run all seeders (auto FK-ordered)                         | `--module <name>` seeds one module |
| `db:push`              | Push the schema directly (Drizzle Kit push)               | dev convenience                    |
| `db:check`             | Drizzle Kit check                                         |                                    |
| `db:studio`            | Open Drizzle Studio GUI                                   |                                    |

## Typical flows

**Add a new module:**

```sh
npm run maker make:module blog
# edit models/seeders
npm run maker db:migrate --seed
```

**Fresh slate with seed data:**

```sh
npm run maker db:fresh --seed
```
