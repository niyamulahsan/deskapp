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

export const handlers = { queue, schedule };