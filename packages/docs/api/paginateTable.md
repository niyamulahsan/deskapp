# `paginate.table` — whole-table pagination

Imported from the facade: `import { paginate } from "@/core/facade.ts"`.

Paginates a full schema table: runs a `count()` query plus the paged select, with optional `where` filter and `orderBy`. The count and the page are always consistent — both queries share the same `where`. See [Database](../guide/database).

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `paginate.table` | `<T>(table: SQLiteTable, options?: PaginateTableOptions) => Promise<PaginatedResult<T>>` | Paginate a whole schema table. |

Options:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | `number` | `1` | 1-indexed, clamped to `last_page`. |
| `perPage` | `number` | `15` | Items per page. |
| `maxPerPage` | `number` | `100` | Clamp on `perPage`. |
| `path` | `string` | `""` | Base path used in generated `*_page_url` links. |
| `where` | `SQL<unknown>` | — | Applied to both the count and the data query (use `sql`). |
| `orderBy` | `unknown[]` | — | Drizzle `orderBy(...args)` spread, e.g. `[sql\`created_at desc\`]`. |

## Use cases

### Simple paged list

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

### Filtered count stays in sync

The `where` you pass is applied to the count too, so `total` reflects only matching rows.

```ts
const admins = await paginate.table(schema.users, {
  where: sql`role = 'admin'`,
  orderBy: [sql`name asc`],
});
// admins.total === rows where role = 'admin'; admins.data is the paged subset
```

## Notes

- `table` must be a **schema table object** — `import * as schema from "@/database/schema.ts"` then `schema.users`, not a string.
- `where` uses `sql`; combine with `sql` for composed filters (exported from the facade).
- For eager-loaded relations, use [`paginate.model`](./paginateModel) instead.

## Related

- [paginate](./paginate) · [paginateQuery](./paginateQuery) · [paginateModel](./paginateModel) · [db](./db)