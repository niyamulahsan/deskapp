import { afterEach, describe, expect, it, vi } from "vitest";
import { cron } from "@/core/utils/scheduler";

afterEach(() => {
  cron.stop();
});

describe("cron (scheduler)", () => {
  it("schedules a job and returns a stoppable handle", async () => {
    let ticks = 0;
    const handle = cron.schedule("test.tick", "* * * * * *", () => {
      ticks++;
    });
    await new Promise((r) => setTimeout(r, 2200));
    handle.stop();
    expect(ticks).toBeGreaterThanOrEqual(1);
  });

  it("replaces a job with the same name", async () => {
    let a = 0;
    let b = 0;
    cron.schedule("test.replace", "* * * * * *", () => {
      a++;
    });
    cron.schedule("test.replace", "* * * * * *", () => {
      b++;
    });
    await new Promise((r) => setTimeout(r, 1100));
    cron.stop();
    expect(a).toBe(0);
    expect(b).toBeGreaterThanOrEqual(1);
  });

  it("stop() halts all jobs", async () => {
    let ticks = 0;
    cron.schedule("test.stopall", "* * * * * *", () => {
      ticks++;
    });
    cron.stop();
    const before = ticks;
    await new Promise((r) => setTimeout(r, 1100));
    expect(ticks).toBe(before);
  });
});
