import { queue as queueApi, cron } from "@/core/facade.ts";

/**
 * demo.controller.ts (app module) - queue & cron sample handlers.
 *
 * Demonstrates the reusable facade primitives from inside real bindings:
 *   - `app.demo.queue` runs a bounded-concurrency in-process queue
 *   - `app.demo.schedule` ticks a cron every second for N seconds, then stops
 *
 * The pattern here is what an app module would use in production:
 * import { queue, cron } from "@/core/facade.ts" in your own controller.
 */

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const queue = async (
  opts?: { items?: string[]; concurrency?: number; delayMs?: number; },
): Promise<Record<string, unknown>> => {
  const items = opts?.items && opts.items.length > 0 ? opts.items : ["a", "b", "c"];
  const concurrency = Math.min(Math.max(opts?.concurrency ?? 2, 1), 8);
  const delayMs = Math.min(Math.max(opts?.delayMs ?? 50, 0), 1000);
  const started = Date.now();

  const q = queueApi.create<string>({ concurrency });
  const results = await Promise.all(
    items.map((name) =>
      q.add(async () => {
        await sleep(delayMs);
        return `processed ${name}`;
      })
    ),
  );

  return { ok: true, results, concurrency, durationMs: Date.now() - started };
};

export const schedule = async (opts?: { seconds?: number; }): Promise<Record<string, unknown>> => {
  const seconds = Math.min(Math.max(opts?.seconds ?? 2, 1), 10);
  let ticks = 0;

  const job = cron.schedule("demo.tick", "* * * * * *", () => {
    ticks += 1;
  });
  await sleep(seconds * 1000);
  job.stop();

  return { ok: true, name: "demo.tick", expression: "* * * * * *", ticked: ticks, seconds };
};

/**
 * demo.controller.ts (app module) - gum data-table sample handlers.
 *
 * `app.demo.table` serves the same paginated envelope `paginate.*` produces
 * (`data/current_page/last_page/per_page/total/from/to/path`), so the UI
 * <DataTable> can bind to it with zero ceremony. Rows are generated in memory
 * here so the starter needs no migration; a real module does exactly the same
 * with a Drizzle model + paginate.model (see docs/guide/gum.md).
 */

interface DemoRow {
  id: number;
  name: string;
  email: string;
  role: string;
  created: string;
}

const demoSeed = Array.from({ length: 137 }, (_, i) => ({
  id: i + 1,
  name: ["Ava", "Leo", "Mia", "Noah", "Zara", "Ivan", "Eli", "Ruth", "Omar", "Nia"][i % 10] + ` ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: ["admin", "editor", "viewer"][i % 3],
  created: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
}));

let demoRows: DemoRow[] = structuredClone(demoSeed);

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export const table = (
  opts?: { page?: number; size?: number; search?: string; },
): Record<string, unknown> => {
  const perPage = Math.min(toPositiveInt(opts?.size, 15), 100);
  const page = toPositiveInt(opts?.page, 1);
  const search = String(opts?.search ?? "").trim().toLowerCase();

  const all = search
    ? demoRows.filter((row) =>
        [row.name, row.email, row.role].some((value) => value.toLowerCase().includes(search)))
    : demoRows;

  const total = all.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, lastPage);
  const offset = (currentPage - 1) * perPage;
  const data = all.slice(offset, offset + perPage);

  return {
    data,
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
    from: total === 0 ? null : offset + 1,
    to: total === 0 ? null : offset + data.length,
    path: "app.demo.table",
  };
};

export const destroy = (
  opts?: { ids?: Array<string | number>; },
): Record<string, unknown> => {
  const ids = new Set((opts?.ids ?? []).map((id) => String(id)));
  const before = demoRows.length;
  demoRows = demoRows.filter((row) => !ids.has(String(row.id)));
  return { ok: true, removed: before - demoRows.length };
};

export const handlers = { queue, schedule, table, destroy };