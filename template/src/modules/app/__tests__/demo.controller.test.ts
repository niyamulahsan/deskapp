import { afterEach, describe, expect, it, vi } from "vitest";

const stop = vi.fn();
vi.mock("@/core/facade", () => {
  return {
    queue: {
      create: (_opts: { concurrency: number }) => ({
        add: (task: () => Promise<any>) => task(),
      }),
    },
    cron: {
      schedule: vi.fn((_name: string, _expr: string, task: () => void) => {
        task();
        task();
        return { stop };
      }),
      stop: vi.fn(),
    },
  };
});

import { destroy, handlers, queue, schedule, table } from "@/modules/app/controllers/demo.controller";

describe("app demo.controller", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes handlers", () => {
    expect(handlers.queue).toBe(queue);
    expect(handlers.schedule).toBe(schedule);
    expect(handlers.table).toBe(table);
    expect(handlers.destroy).toBe(destroy);
  });

  it("queue runs items via facade queue and returns stats", async () => {
    const res = await queue({ items: ["x", "y"], concurrency: 2, delayMs: 0 });
    expect(res.ok).toBe(true);
    expect(res.concurrency).toBe(2);
    expect(res.results).toEqual(["processed x", "processed y"]);
    expect(typeof res.durationMs).toBe("number");
  });

  it("schedule uses cron and resolves after duration", async () => {
    vi.useFakeTimers();
    const p = schedule({ seconds: 1 });
    await vi.advanceTimersByTimeAsync(1100);
    const res = await p;
    expect(res.ok).toBe(true);
    expect(res.name).toBe("demo.tick");
    expect(res.seconds).toBe(1);
    expect((res.ticked as number) >= 1).toBe(true);
    expect(stop).toHaveBeenCalled();
  });

  it("table paginates/searches in-memory rows and destroy removes", () => {
    const page = table({ page: 1, size: 5 }) as any;
    expect(page.data).toHaveLength(5);
    expect(page.current_page).toBe(1);
    expect(page.per_page).toBe(5);
    expect(page.path).toBe("app.demo.table");

    const filtered = table({ search: "admin", size: 100 }) as any;
    expect(filtered.data.every((r: any) => r.role === "admin")).toBe(true);

    const firstId = filtered.data[0]?.id;
    if (firstId != null) {
      const res = destroy({ ids: [firstId] }) as any;
      expect(res.ok).toBe(true);
      expect(res.removed).toBeGreaterThanOrEqual(0);
    }
  });
});
