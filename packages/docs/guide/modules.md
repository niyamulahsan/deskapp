# Modules

Modules are self-contained feature areas under `src/modules/<name>/`. A module can hold controllers, database models and seeders — the framework discovers each automatically.

## Module layout

```
src/modules/<name>/
  controllers/
    <controller>.controller.ts   # named handlers + `handlers` map
    <controller>.schema.ts       # Zod schemas (optional)
  database/
    models/
      <model>.model.ts           # Drizzle table definition
    seeders/
      <seeder>.seed.ts           # default export + `table` for FK ordering
```

## Create a module

```sh
npm run maker make:module blog
# or
npx deskapp maker make:module blog
```

Creates `src/modules/blog/` with a sample model + seeder. Then add a controller:

```sh
npm run maker make:controller blog Post
```

Creates `src/modules/blog/controllers/post.controller.ts` (+ optional schema).

## Controllers

A controller file exports named handlers plus a `handlers` map. The registry binds each as `bindings['<module>.<controller>.<handler>']`:

```ts
import { db, paginate } from "@/core/facade";
import { posts } from "@/modules/blog/database/models/post.model";

export const list = async (): Promise<Record<string, unknown>> => {
  return await paginate.model({ table: posts, query: db.query.posts });
};
export const handlers = { list };
```

becomes `bindings['blog.post.list']()` in the UI. See [Controllers & Bindings](./controllers.md).

## Models

Models are Drizzle table definitions. The maker CLI regenerates `src/database/schema.ts` to re-export every `modules/*/database/models/*.model.ts`.

See [Database](./database.md).

## Seeders

A seeder is the default export of a `*.seed.ts` file. Export its `table` so the runner can order seeders by foreign keys:

```ts
import { users } from "@/modules/blog/database/models/user.model";

export const table = users;

export default async () => {
  // insert rows...
};
```

Run all seeders with the maker CLI. See [Database Commands](../cli/database.md).

## Naming rules

- Files must end in exactly `*.controller.ts`, `*.model.ts`, `*.seed.ts`.
- Handler names are `camelCase`; bindings use the file basename (minus `.controller.ts`) as the controller segment.
- Avoid duplicate basenames across modules.
