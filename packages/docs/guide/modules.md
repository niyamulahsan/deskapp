# Modules

Modules are self-contained feature areas under `src/modules/<name>/`. A module can hold controllers, database models and seeders — the framework discovers each automatically.

## Module layout

A module is a self-contained feature area: it can hold controllers (+ their Zod schemas) and database models/seeders. The structure below is what a module _can_ contain — mirroring the stubs that `deno task maker make:module` / `maker make:controller` generate:

```
src/modules/<name>/
  controllers/
    <controller>.controller.ts   # named handlers + `handlers` map
    <controller>.schema.ts       # Zod schemas (CRUD validation)
  database/
    models/
      <model>.model.ts           # Drizzle table definition
    seeders/
      <seeder>.seed.ts           # default export + `table` for FK ordering
```

Each module wires one or more framework capabilities into bindings. A typical set of controllers maps like this:

```
# example - how controllers map framework capabilities into bindings
src/modules/<module>/controllers/
  browser.controller.ts   # <module>.browser.visit()      -> chromium API + Playwright
  files.controller.ts     # <module>.files.open/list      -> pickers + files
  net.controller.ts       # <module>.net.fetchJson(url)   -> CORS-free proxy
  jobs.controller.ts      # <module>.jobs.submit()        -> queue
  monitor.controller.ts   # <module>.monitor.schedule()   -> cron
```

Every controller is a thin bridge: it imports its capability from `@/core/facade.ts` and exposes it to the UI as a binding (see [Controllers & Bindings](./controllers.md)). Copy the pattern, don't re-implement.

## Create a module

```sh
deno task maker make:module blog
```

Creates `src/modules/blog/` with a sample model + seeder. Then add a controller:

```sh
deno task maker make:controller blog Post
```

Creates `src/modules/blog/controllers/post.controller.ts` (+ a Zod schema stub).

## Controllers

A controller file exports named handlers plus a `handlers` map. The registry binds each as `bindings['<module>.<controller>.<handler>']`:

```ts
export const list = async (): Promise<Record<string, unknown>> => {
  return await paginate.model({ table: schema.posts, query: db.query.posts });
};
export const handlers = { list };
```

becomes `bindings['blog.post.list']()` in the UI.

See [Controllers & Bindings](./controllers.md).

## Models

Models are Drizzle table definitions. `deno task maker db:schema` regenerates `src/database/schema.ts` to re-export every `modules/*/database/models/*.model.ts`.

See [Database](./database.md).

## Seeders

A seeder is the default export of a `*.seed.ts` file. It should export its `table` so the runner can order seeders by foreign keys automatically:

```ts
import { users } from "@/modules/blog/database/models/user.model.ts";

export const table = users;

export default async () => {
  // insert rows...
};
```

Run all seeders: `deno task maker db:seed`. See [Database Commands](../cli/database.md).

## Naming rules

- Files must end in exactly `*.controller.ts`, `*.model.ts`, `*.seed.ts`.
- Handler names are `camelCase`; bindings use the file basename (minus `.controller.ts`) as the controller segment.
- Avoid duplicate basenames across modules (`blog/post.controller.ts` and `auth/post.controller.ts` collide).
