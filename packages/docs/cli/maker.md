# Maker Commands

The `maker` CLI scaffolds source files, drives the database, and supports development workflows.

```sh
npm run maker            # list all commands
# or
npx deskapp maker
npm run maker make:module blog
npm run maker db:status
```

## make:* - scaffolding

| Command | Arguments | Options | Creates |
| --- | --- | --- | --- |
| `make:module` | `<name:string>` | `--force` | `src/modules/<name>/` with a model + seeder (plus controller + schema) |
| `make:model` | `<module:string> <name:string>` | `--force`, `--dry-run` | `src/modules/<module>/database/models/<snake>.model.ts` |
| `make:seeder` | `<module:string> <name:string>` | `--force`, `--dry-run` | `src/modules/<module>/database/seeders/<snake>.seed.ts` |
| `make:controller` | `<module:string> <name:string>` | `--force`, `--dry-run` | controller + Zod schema pair in the module's `controllers/` |

After creating files, update the schema and run migrations as needed. See [Database Commands](./database.md).

## Database family

The `db:*` commands live under the same CLI — see [Database Commands](./database.md).

## Run / build family

```sh
npm run dev            # dev with hot reload
npm run build          # build UI and Electron
npm run package        # build and package with electron-builder
```
