/**
 * database/paginate.ts - nexgen-style pagination, mirroring nexgen's
 * framework/database/paginate.ts but without a request/HTTP context (bindings
 * call handlers directly, so pagination here is callback- or table-based).
 *
 * Core is `paginate.query`: it normalizes page/per_page, clamps with
 * maxPerPage, computes URL meta + links, then runs the caller's
 * `total()` and `data(limit, offset)` callbacks. Import from the facade:
 *
 *   import { paginate } from "@/core/facade.ts";
 *   await paginate.table(schema.users, { page: 2 });
 *   await paginate.query({ total, data });
 *   await paginate.model({ table: schema.users, query: db.query.users });
 */

import { count, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/core/facade.ts";

export type PaginateInput = {
  page?: number;
  perPage?: number;
  maxPerPage?: number;
  path?: string;
};

export type PaginatedResult<T> = {
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

export type PaginateQueryOptions<T> = PaginateInput & {
  total: () => Promise<number>;
  data: (limit: number, offset: number) => Promise<T[]>;
};

export type PaginateTableOptions = PaginateInput & {
  where?: SQL<unknown>;
  orderBy?: unknown[];
};

export type PaginateModelOptions<T = unknown> = PaginateInput & {
  table?: SQLiteTable;
  query?: { findMany: (args: Record<string, unknown>) => Promise<T[]>; };
  where?: SQL<unknown>;
  with?: Record<string, unknown>;
  columns?: Record<string, unknown>;
  extras?: Record<string, unknown>;
  orderBy?: unknown;
  total?: () => Promise<number>;
  data?: (params: { limit: number; offset: number; }) => Promise<T[]>;
};

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function pageUrl(path: string | undefined, page: number, perPage: number): string | null {
  if (!path) return null;
  const delimiter = path.includes("?") ? "&" : "?";
  return `${path}${delimiter}page=${page}&per_page=${perPage}`;
}

/**
 * Pagination namespace - nexgen-style envelope for Drizzle, surfaced through
 * the facade. Access: `paginate.query`, `paginate.table`, `paginate.model`.
 */
export const paginate = {
  /**
   * Generic paginator for custom `total()`/`data(limit, offset)` callbacks.
   * Controllers/services compose any query (joins, filters, aggregates) and
   * get a consistent nexgen-style envelope back.
   */
  query<T = unknown>(options: PaginateQueryOptions<T>): Promise<PaginatedResult<T>> {
    return paginateQuery<T>(options);
  },

  /**
   * Paginates a full Drizzle table with optional `where` filter and `orderBy`.
   * Runs a count query plus the paged select. table must be a SCHEMA table
   * object: `import * as schema from "@/database/schema.ts"` then `schema.users`.
   */
  table<T = unknown>(table: SQLiteTable, options: PaginateTableOptions = {}): Promise<PaginatedResult<T>> {
    return paginateTable<T>(table, options);
  },

  /**
* nexgen-style pagination for Drizzle RELATIONAL queries - mirrors nexgen's
   * paginateModel. Counts via `table` (+ `where`), then pages through
   * `db.query.<table>.findMany({ limit, offset, where, with, columns, extras,
   * orderBy })` for eager-loaded resources.
   */
  model<T = unknown>(options: PaginateModelOptions<T>): Promise<PaginatedResult<T>> {
    return paginateModel<T>(options);
  },
};

/** Generic paginator for custom `total()`/`data(limit, offset)` callbacks. */
async function paginateQuery<T = unknown>(options: PaginateQueryOptions<T>): Promise<PaginatedResult<T>> {
  const maxPerPage = toPositiveInt(options.maxPerPage, 100);
  const perPage = Math.min(toPositiveInt(options.perPage, 15), maxPerPage);
  const page = toPositiveInt(options.page, 1);

  const total = Number(await options.total());
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, lastPage);
  const safeOffset = (currentPage - 1) * perPage;
  const data = await options.data(perPage, safeOffset);

  const from = total === 0 ? null : safeOffset + 1;
  const to = total === 0 ? null : safeOffset + data.length;
  const path = options.path || "";
  const firstPageUrl = pageUrl(path, 1, perPage);
  const lastPageUrl = pageUrl(path, lastPage, perPage);
  const prevPageUrl = currentPage > 1 ? pageUrl(path, currentPage - 1, perPage) : null;
  const nextPageUrl = currentPage < lastPage ? pageUrl(path, currentPage + 1, perPage) : null;

  return {
    current_page: currentPage,
    data,
    first_page_url: firstPageUrl,
    from,
    last_page: lastPage,
    last_page_url: lastPageUrl,
    next_page_url: nextPageUrl,
    path,
    per_page: perPage,
    prev_page_url: prevPageUrl,
    to,
    total,
  };
}

/** Paginates a full Drizzle table with optional `where` filter and `orderBy`. */
function paginateTable<T = unknown>(table: SQLiteTable, options: PaginateTableOptions = {}): Promise<PaginatedResult<T>> {
  return paginateQuery<T>({
    page: options.page,
    perPage: options.perPage,
    maxPerPage: options.maxPerPage,
    path: options.path,
    total: async () => {
      // deno-lint-ignore no-explicit-any
      let totalQuery: any = db.select({ total: count() }).from(table);
      if (options.where) totalQuery = totalQuery.where(options.where);
      const totalRow = await totalQuery;
      return Number(totalRow[0]?.total ?? 0);
    },
    data: (limit, offset) => {
      // deno-lint-ignore no-explicit-any
      let dataQuery: any = db.select(getTableColumns(table)).from(table);
      if (options.where) dataQuery = dataQuery.where(options.where);
      if (options.orderBy?.length) dataQuery = dataQuery.orderBy(...options.orderBy);
      return dataQuery.limit(limit).offset(offset);
    },
  });
}

/**
 * nexgen-style pagination for Drizzle RELATIONAL queries - mirrors nexgen's
 * paginateModel. Counts via `table` (+ `where`), then pages through
 * `db.query.<table>.findMany({ limit, offset, where, with, columns, extras,
 * orderBy })` for eager-loaded resources.
 *
 * Supply either callbacks (`total`/`data`) or the declarative pair
 * (`table` + `query`) - the same fallbacks engine uses:
 *
 *   import * as schema from "@/database/schema.ts";
 *   const page = await paginate.model({
 *     page: 2, perPage: 15,
 *     table: schema.users,
 *     query: db.query.users,
 *     where: sql`active = true`,
 *     with: { posts: true },
 *     orderBy: (t, { desc }) => desc(t.createdAt),
 *   });
 */
function paginateModel<T = unknown>(options: PaginateModelOptions<T>): Promise<PaginatedResult<T>> {
  return paginateQuery<T>({
    page: options.page,
    perPage: options.perPage,
    maxPerPage: options.maxPerPage,
    path: options.path,
    total: async () => {
      if (options.total) return Number(await options.total());
      if (!options.table) {
        throw new Error("paginate.model requires either table or total callback");
      }
      // deno-lint-ignore no-explicit-any
      let totalQuery: any = db.select({ total: count() }).from(options.table);
      if (options.where) totalQuery = totalQuery.where(options.where);
      const [row] = await totalQuery;
      return Number(row?.total ?? 0);
    },
    data: (limit, offset) => {
      if (options.data) return options.data({ limit, offset });
      if (!options.query) {
        throw new Error("paginate.model requires either query or data callback");
      }
      const args: Record<string, unknown> = { limit, offset };
      if (options.where) args.where = options.where;
      if (options.with) args.with = options.with;
      if (options.columns) args.columns = options.columns;
      if (options.extras) args.extras = options.extras;
      if (options.orderBy) args.orderBy = options.orderBy;
      return options.query.findMany(args);
    },
  });
}

// `sql` is re-exported so callers writing `where: sql` filters don't need a
// second drizzle import: import { paginate, sql } from "@/core/facade.ts".
export { sql };