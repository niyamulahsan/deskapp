# Modules

Modules are self-contained feature areas under `src/modules/<name>/`. A module can hold controllers, database models and seeders — the framework discovers each automatically.

## Module layout

```
src/modules/<name>/
  facade.ts                      # public API of the module (cross-module imports)
  controllers/
    <controller>.controller.ts   # named handlers + `handlers` map
    <controller>.schema.ts       # Zod schema + inferred `<X>Type` (optional)
  database/
    models/
      <model>.model.ts           # Drizzle table definition
    seeders/
      <seeder>.seed.ts           # default export + `table` for FK ordering
```

## Create a module

```sh
npm run maker make:module blog
```

Creates `src/modules/blog/` with a sample model + seeder, a controller, and the
module's `facade.ts`. Then add a controller:

```sh
npm run maker make:controller blog Post
```

Creates `src/modules/blog/controllers/post.controller.ts` (+ optional schema).

## Controllers

A controller file exports named handlers plus a `handlers` map. The registry binds each as `bindings['<module>.<controller>.<handler>']`:

```ts
// ./src/modules/blog/controllers/post.controller.ts

import { db, paginate } from "@/core/facade";
import { posts } from "@/modules/blog/database/models/post.model";

export const list = async (): Promise<Record<string, unknown>> => {
  return await paginate.model({ table: posts, query: db.query.posts });
};
export const handlers = { list };
```

becomes `bindings['blog.post.list']()` in the UI. See [Controllers & Bindings](./controllers.md).

## Cross-module access (the facade)

Every module has a `facade.ts` at its root — its **public API**. Other modules
import from there, never from a module's `controllers/` or `database/` directly:

```ts
// ./src/modules/wallet/facade.ts

export * as wallet from "./controllers/wallet.controller";
export * from "./database/models/wallet.model";
```

```ts
// ./src/modules/order/controllers/order.controller.ts

import { wallet } from "@/modules/wallet/facade";

export const index = async () => wallet.list();
```

A module never imports its own facade, and a facade never imports another facade.
Add a namespace line to the facade for each controller you want to share. See
[Conventions](/guide/conventions#module-facades).

## Models

Models are Drizzle table definitions. The maker CLI regenerates `src/database/schema.ts` to re-export every `modules/*/database/models/*.model.ts`.

See [Database](./database.md).

## Seeders

A seeder is the default export of a `*.seed.ts` file. Export its `table` so the runner can order seeders by foreign keys:

```ts
// ./src/modules/blog/database/seeders/user.seed.ts

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
