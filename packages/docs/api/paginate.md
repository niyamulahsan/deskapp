# `paginate` — pagination envelope

Imported from the facade: `import { paginate, sql } from "@/core/facade.ts"`.

[nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination over Drizzle. `paginate` is a namespace with three methods — [`paginate.query`](./paginateQuery), [`paginate.table`](./paginateTable), [`paginate.model`](./paginateModel) — that all return the **same `PaginatedResult` envelope**. It normalizes `page`/`perPage`, clamps to `maxPerPage`, computes the URL meta, and runs the count + paged select. See [Database](../guide/database).

`sql` is re-exported alongside `paginate` so you can write `where: sql` filters without a second Drizzle import.

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `paginate.query` | `<T>(options: PaginateQueryOptions<T>) => Promise<PaginatedResult<T>>` | Fully custom `total()` / `data(limit, offset)` pagination — joins, aggregates, anything. |
| `paginate.table` | `<T>(table: SQLiteTable, options?: PaginateTableOptions) => Promise<PaginatedResult<T>>` | Paginate a whole schema table with optional `where` / `orderBy`. |
| `paginate.model` | `<T>(options: PaginateModelOptions<T>) => Promise<PaginatedResult<T>>` | Paginate relational queries (`db.query.<table>`) with `with` / `columns` / `extras`. |

## Which one do I use?

| You want to… | Use |
| --- | --- |
| Paginate the full rows of one table | [`paginate.table`](./paginateTable) (`paginate.table(schema.users, { page: 2 })`) |
| Paginate eager-loaded relations (`db.query.<table>`) | [`paginate.model`](./paginateModel) (`with: { posts: true }`) |
| Own the count and data queries completely (joins, aggregates) | [`paginate.query`](./paginateQuery) (you supply `total` + `data`) |

## Shared envelope

All four pages return the same shape — ready for the UI:

```ts
type PaginatedResult<T> = {
  current_page: number;
  data: T[];
  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
};
```

Common pagination input (each method accepts these):

```ts
interface PaginateInput {
  page?: number;      // 1-indexed, clamped to last_page
  perPage?: number;   // items per page (default 15)
  maxPerPage?: number;// clamp on perPage (default 100)
  path?: string;      // base path used in generated *_page_url links
}
```

## Notes

- `page` never exceeds `last_page`; `perPage` is clamped by `maxPerPage` (default 100).
- The envelope uses the same field names as [nexgen](https://niyamulahsan.github.io/nexgen/)'s paginator — ready for the UI.
- Each method is documented on its own page ([query](./paginateQuery) · [table](./paginateTable) · [model](./paginateModel)).

## Related

- [paginateQuery](./paginateQuery) · [paginateTable](./paginateTable) · [paginateModel](./paginateModel) · [db](./db)