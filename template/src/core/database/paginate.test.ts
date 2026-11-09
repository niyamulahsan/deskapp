import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { total: 0, rows: [] as unknown[] };

vi.mock("@/core/facade", () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then: (resolve: any) => resolve([{ total: state.total }]),
  };
  // make data path return rows by treating final await via thenable behavior carefully
  return { db: { select: () => chain } };
});

import { paginate } from "@/core/database/paginate";

describe("paginate.query", () => {
  it("returns a nexgen-style envelope and slices data", async () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const res = await paginate.query({
      page: 2,
      perPage: 10,
      path: "/users",
      total: async () => items.length,
      data: async (limit, offset) => items.slice(offset, offset + limit),
    });
    expect(res.current_page).toBe(2);
    expect(res.per_page).toBe(10);
    expect(res.total).toBe(25);
    expect(res.last_page).toBe(3);
    expect(res.from).toBe(11);
    expect(res.to).toBe(20);
    expect(res.data).toHaveLength(10);
    expect(res.next_page_url).toContain("page=3");
    expect(res.prev_page_url).toContain("page=1");
  });

  it("clamps page/perPage and handles empty results", async () => {
    const res = await paginate.query({
      page: 99,
      perPage: 999,
      maxPerPage: 50,
      total: async () => 3,
      data: async () => [{ id: 1 }],
    });
    expect(res.per_page).toBe(50);
    expect(res.current_page).toBe(1);
    expect(res.path).toBe("");

    const empty = await paginate.query({
      total: async () => 0,
      data: async () => [],
    });
    expect(empty.from).toBeNull();
    expect(empty.to).toBeNull();
    expect(empty.last_page).toBe(1);
  });
});

describe("paginate.model", () => {
  it("throws when table/query/callbacks are missing", async () => {
    await expect(paginate.model({} as any)).rejects.toThrow(/requires either table or total/);
    await expect(paginate.model({ table: {} as any } as any)).rejects.toThrow(/requires either query or data/);
  });

  it("uses total/data callbacks when provided", async () => {
    const res = await paginate.model({
      page: 1,
      perPage: 2,
      total: async () => 5,
      data: async ({ limit, offset }) => [limit, offset] as any,
    });
    expect(res.total).toBe(5);
    expect(res.data).toEqual([2, 0]);
  });
});
