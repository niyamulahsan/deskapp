# `paginate` — pagination

Imported from the facade: `import { paginate, sql } from "@/core/facade.ts"`.

[nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination over Drizzle: normalizes `page`/`perPage`, clamps to `maxPerPage`, computes URL/`links` meta, and runs the count + paged select. Use `table` for whole-table reads, `model` for relational eager-loaded reads, and `query` for fully custom queries — all return the same envelope. See [Database](../guide/database).

## Functions

| Function | Signature | Description |
| --- | --- | --- |
| `query` | `<T>(options: PaginateQueryOptions<T>) => Promise<PaginatedResult<T>>` | Generic paginator over your own `total()` and `data(limit, offset)` callbacks. |
| `table` | `<T>(table: SQLiteTable, options?: PaginateTableOptions) => Promise<PaginatedResult<T>>` | Paginate a whole schema table with optional `where`/`orderBy`. |
| `model` | `<T>(options: PaginateModelOptions<T>) => Promise<PaginatedResult<T>>` | Paginate relational queries (`db.query.<table>`) with `with`, `columns`, `extras`. |

`sql` is re-exported as a top-level facade member for writing `where` filters.

## Types

```ts
type PaginatedResult<T> = {
  current_page: number; data: T[]; from: number | null;
  last_page: number; to: number | null; total: number; per_page: number;
  path: string; first_page_url: string | null; last_page_url: string | null;
  prev_page_url: string | null; next_page_url: string | null;
};

interface PaginateInput { page?: number; perPage?: number; maxPerPage?: number; path?: string; }

interface PaginateQueryOptions<T> extends PaginateInput {
  total: () => Promise<number>;
  data: (limit: number, offset: number) => Promise<T[]>;
}

interface PaginateTableOptions extends PaginateInput { where?: SQL<unknown>; orderBy?: unknown[]; }

interface PaginateModelOptions<T = unknown> extends PaginateInput {
  table?: SQLiteTable;                // used for the count
  query?: { findMany: (args: Record<string, unknown>) => Promise<T[]> };
  where?: SQL<unknown>; with?: Record<string, unknown>;
  columns?: Record<string, unknown>; extras?: Record<string, unknown>; orderBy?: unknown;
  total?: () => Promise<number>;      // custom count (overrides table)
  data?: (p: { limit: number; offset: number }) => Promise<T[]>; // custom data (overrides query)
}
```

## Use cases

### Simple list endpoint (whole table)

`paginate.table` — a schema table, optional filter + order, one call.

```ts
import { paginate, sql } from "@/core/facade.ts";
import * as schema from "@/database/schema.ts";

const page = await paginate.table(schema.users, {
  page: 1, perPage: 20, path: "/users",
  where: sql`active = true`,
  orderBy: [sql`created_at desc`],
});

return { rows: page.data, meta: { current: page.current_page, last: page.last_page, total: page.total } };
```

### Relational feed with eager loading (posts + author)

`paginate.model` pages through `db.query.<table>.findMany` with `with`, so every item ships with its relations.

```ts
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

### Fully custom queries (joins, aggregates)

`paginate.query` — you own `total()` and `data(limit, offset)`, so anything you can express with Drizzle works.

```ts
const report = await paginate.query({
  page: 1, perPage: 50, maxPerPage: 200, path: "/report",
  total: async () => Number((await db.select({ total: count() }).from(schema.orders)).at(0)?.total),
  data: (limit, offset) =>
    db.select()
      .from(schema.orders)
      .innerJoin(schema.users, sql`users.id = orders.user_id`)
      .limit(limit).offset(offset),
});
```

### URL-aware navigation in the UI

The envelope already computed the page URLs — the frontend can just follow them.

```ts
// UI
if (page.next_page_url) {
  const next = await bindings['app.users.list']({ path: page.next_page_url });
}
// or simply read page.current_page / page.last_page / page.prev_page_url / page.next_page_url
```

## Notes

- `page` never exceeds `last_page`; `perPage` is clamped by `maxPerPage` (default 100).
- The envelope uses the same field names as [nexgen](https://niyamulahsan.github.io/nexgen/)'s paginator — ready for the UI.