import { describe, expect, it } from "vitest";
import { queue } from "@/core/utils/queue";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("queue (bounded concurrency)", () => {
  it("runs tasks and resolves with their results", async () => {
    const q = queue.create<number>({ concurrency: 2 });
    const results = await Promise.all([q.add(async () => 1), q.add(async () => 2), q.add(async () => 3)]);
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it("respects concurrency", async () => {
    const q = queue.create<void>({ concurrency: 2 });
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await delay(20);
      active--;
    };
    await Promise.all([q.add(task), q.add(task), q.add(task), q.add(task), q.add(task)]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("rejects only the failing task", async () => {
    const q = queue.create<string>({ concurrency: 2 });
    const ok = q.add(async () => "ok");
    const bad = q.add(async () => {
      throw new Error("boom");
    });
    const ok2 = q.add(async () => "ok2");
    await expect(ok).resolves.toBe("ok");
    await expect(bad).rejects.toThrow("boom");
    await expect(ok2).resolves.toBe("ok2");
  });
});
