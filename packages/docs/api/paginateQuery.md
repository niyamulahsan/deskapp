# `paginate.query` — custom pagination

Imported from the facade: `import { paginate } from "@/core/facade.ts"`.

The generic paginator. You own both halves of the query — a `total()` callback that counts, and a `data(limit, offset)` callback that pages — so anything you can express with Drizzle (joins, filters, aggregates, `DISTINCT`) works, and you still get a consistent nexgen-style envelope back. See [Database](../guide/database).

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `paginate.query` | `<T>(options: PaginateQueryOptions<T>) => Promise<PaginatedResult<T>>` | Paginate over your own `total()` and `data(limit, offset)` callbacks. |

Options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-indexed, clamped to `last_page`. |
| `perPage` | `number` | `15` | Items per page. |
| `maxPerPage` | `number` | `100` | Clamp on `perPage`. |
| `path` | `string` | `""` | Base path used in generated `*_page_url` links. |
| `total` | `() => Promise<number>` | — | Count query; must resolve to the total row count. |
| `data` | `(limit: number, offset: number) => Promise<T[]>` | — | Paged select; receives the effective `limit` and `offset`. |

## Use cases

### Fully custom query (joins + aggregate count)

```ts
import { count } from "drizzle-orm";
import { db, paginate, sql } from "@/core/facade.ts";
import * as schema from "@/database/schema.ts";

const report = await paginate.query({
  page: 1, perPage: 50, maxPerPage: 200, path: "/report",
  total: async () =>
    Number((await db.select({ total: count() }).from(schema.orders)).at(0)?.total),
  data: (limit, offset) =>
    db.select()
      .from(schema.orders)
      .innerJoin(schema.users, sql`users.id = orders.user_id`)
      .limit(limit).offset(offset),
});
```

### With a `WHERE` filter on both sides

Keep the count and the page consistent by applying the same condition.

```ts
const active = await paginate.query({
  page: 2, perPage: 20,
  total: async () =>
    Number((await db.select({ total: count() }).from(schema.users).where(sql`active = true`)).at(0)?.total),
  data: (limit, offset) =>
    db.select().from(schema.users).where(sql`active = true`).limit(limit).offset(offset),
});
```

## Notes

- `total()` and `data(limit, offset)` may be async and are awaited sequentially.
- The count runs exactly once; the data query runs once with the clamped page/perPage.
- `page` is clamped to the computed `last_page`, so over-paging returns the last page with an empty overflow rather than an error.

## Related

- [paginate](./paginate) · [paginateTable](./paginateTable) · [paginateModel](./paginateModel) · [db](./db)