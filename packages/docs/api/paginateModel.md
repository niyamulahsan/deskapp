# `paginate.model` — relational pagination

Imported from the facade: `import { paginate, db } from "@/core/facade.ts"`.

nexgen-style pagination for Drizzle **relational** queries — mirrors nexgen's `paginateModel`. It counts via the schema `table` (plus a shared `where`) and pages through `db.query.<table>.findMany({ limit, offset, where, with, columns, extras, orderBy })`, so every item ships with its eager-loaded relations. See [Database](../guide/database).

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `paginate.model` | `<T>(options: PaginateModelOptions<T>) => Promise<PaginatedResult<T>>` | Paginate relational queries with eager loading. |

Options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-indexed, clamped to `last_page`. |
| `perPage` | `number` | `15` | Items per page. |
| `maxPerPage` | `number` | `100` | Clamp on `perPage`. |
| `path` | `string` | `""` | Base path used in generated `*_page_url` links. |
| `table` | `SQLiteTable` | — | Schema table used for the `count()` (e.g. `schema.posts`). |
| `query` | `{ findMany: (args) => Promise<T[]> }` | — | The relational query surface, e.g. `db.query.posts`. |
| `where` | `SQL<unknown>` | — | Applied to both the count and `findMany`. |
| `with` | `Record<string, unknown>` | — | Eager-load relations (`{ author: true }`). |
| `columns` | `Record<string, unknown>` | — | Column selection passed to `findMany`. |
| `extras` | `Record<string, unknown>` | — | Extra fields passed to `findMany`. |
| `orderBy` | `unknown` | — | Drizzle relational `orderBy` (callback or SQL array). |
| `total` | `() => Promise<number>` | — | Custom count — overrides `table` + `where`. |
| `data` | `(params: { limit: number; offset: number }) => Promise<T[]>` | — | Custom data loader — overrides `query`. |

## Use cases

### Feed with eager-loaded relations (posts + author)

```ts
import { paginate, db, sql } from "@/core/facade.ts";
import * as schema from "@/database/schema.ts";

const feed = await paginate.model({
  page: 1, perPage: 15, path: "/feed",
  table: schema.posts,
  query: db.query.posts,
  where: sql`published = true`,
  with: { author: true },
  orderBy: (t, { desc }) => desc(t.createdAt),
});

// feed.data[i].author is already loaded
```

### Profile list with hidden columns

Select with `columns` to drop sensitive fields on every page.

```ts
const users = await paginate.model({
  page: 2, perPage: 25,
  table: schema.users,
  query: db.query.users,
  columns: { password: false, rememberToken: false },
  orderBy: (t, { desc }) => desc(t.id),
});
```

### Fully custom count or data

Supply `total` and/or `data` to override the defaults for weird queries.

```ts
const page = await paginate.model({
  page: 1, perPage: 10,
  total: async () => Number((await db.select({ total: count() }).from(schema.posts)).at(0)?.total),
  data: ({ limit, offset }) =>
    db.query.posts.findMany({ limit, offset, with: { author: true } }),
});
```

## Notes

- Requires either `table` + `query` (declarative) or `total` + `data` (callbacks) — see the error messages for which one is missing.
- The `where` condition is shared by the count and the `findMany` call so `total` always matches the paged rows.
- Use `paginate.query` when the query is too custom for `findMany` (joins, aggregates).

## Related

- [paginate](./paginate) · [paginateQuery](./paginateQuery) · [paginateTable](./paginateTable) · [db](./db)