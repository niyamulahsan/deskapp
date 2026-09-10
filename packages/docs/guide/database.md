# Database

Deskapp ships SQLite via [Drizzle ORM](https://orm.drizzle.team), with schema generation, migrations, seeding, and [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination.

## Connection

`db.init()` opens the database (called at boot in `src/main.ts`), `db.close()` closes it. `db` is both the Drizzle instance *and* the lifecycle handle:

```ts
import { db, pass, sql } from "@/core/facade.ts";
import { users } from "@/modules/auth/database/models/user.model.ts";

await db.insert(users).values({
  name: "Ada",
  email: "ada@example.com",
  password: await pass.hashPassword("secret"),
});
const rows = await db.select().from(users);
```

### Driver

`src/core/database/connection.ts` detects the runtime:

- Drops to `node:sqlite` via Drizzle's sqlite-proxy inside a packaged/desktop build (no extra binary).
- Uses `@libsql/client` under plain `deno run` / dev otherwise.

`drizzle.config.ts` points `dbCredentials` at the `DATABASE_URL` SQLite file (default `sqlite:./src/storage/deskapp.sqlite`).

## Schema

Models are the importable units — each `modules/*/database/models/*.model.ts` exports its table(s). App code imports them **directly from their module**:

```ts
import { users } from "@/modules/auth/database/models/user.model.ts";
import { posts } from "@/modules/blog/database/models/post.model.ts";
```

`src/database/schema.ts` is a **generated aggregate** (`deno task maker db:schema`, built by `src/core/database/aggregate.ts`) that re-exports every model via `export * from "../modules/.../models/....model.ts"`. You normally don't import it in app code — the framework's layers use it when they need the whole schema at once: registering all tables on the Drizzle client (`drizzle(client, { schema })`, which powers the relational `db.query.<table>` API), and the pagination/migration tooling. Regenerate it after adding or removing a model.

- Migrations are generated to `src/database/migrations/sqlite/` by `deno task maker db:generate` / `db:migrate`.

## Models

```ts
// src/modules/blog/database/models/post.model.ts
import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

function definePosts() {
  return sqliteTable("posts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default("current_timestamp"),
  });
}

export type PostTable = ReturnType<typeof definePosts>;
export const posts: PostTable = definePosts();

export const postsRelations: Relations = relations(posts, () => ({}));
```

Foreign keys between models are introspected by the seed runner for automatic ordering.

## Pagination

Three helpers, all returning one nexgen-style envelope:

```ts
type PaginatedResult<T> = {
  current_page, data, first_page_url, from, last_page,
  last_page_url, next_page_url, path, per_page,
  prev_page_url, to, total
};
```

```ts
// table-based
await paginate.table(users, {
  page: 2, perPage: 15, path: "/users",
  where: sql`active = true`,
});

// relational (eager-load via db.query.*.findMany)
await paginate.model({
  page: 1, perPage: 20,
  table: users,
  query: db.query.users,
  where: sql`role_id = 1`,
  with: { posts: true },
  orderBy: (t, { desc }) => desc(t.createdAt),
});

// custom queries
await paginate.query({
  page, perPage, maxPerPage: 100, path,
  total: async () => count,
  data: async (limit, offset) => rows,
});
```

`perPage` is clamped by `maxPerPage` (default 100) and the page never exceeds `last_page`.

## Seeders

Seeders live at `modules/*/database/seeders/*.seed.ts`. Each exports its `table` (used to auto-derive FK ordering) and a default async runner:

```ts
import { users } from "@/modules/auth/database/models/user.model.ts";

export const table = users;

export default async () => {
  // insert roles/users here...
};
```

- `deno task maker db:seed` — run all seeders in FK order (topological sort; errors on cycles)
- `deno task maker db:seed --module=blog` — seed one module only

## Migration hooks

`src/core/database/migrate-hooks.ts` runs after migrations — the wiring point for "after every migration also do X" (e.g. re-seeding).

## Commands

All database operations go through the maker CLI — see [Database Commands](../cli/database.md):

`schema`, `generate`, `migrate`, `migrate:run`, `fresh`, `reset` / `wipe`, `status`, `seed`, `push`, `check`, `studio`.