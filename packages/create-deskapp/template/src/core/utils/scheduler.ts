import { Cron } from "croner";

/**
 * scheduler.ts - reusable cron scheduling backed by `croner`.
 *
 * Named schedules are unique (same name replaces the old job). Call
 * `cron.stop()` on shutdown for all jobs. Import via the facade:
 * `import { cron } from "@/core/facade.ts"`.
 */

const jobs = new Map<string, Cron>();

export interface CronHandle {
  stop(): void;
}

/**
 * Cron namespace - schedule/replace unique named jobs and stop them all at
 * shutdown. Access through the facade: `cron.schedule(...)`, `cron.stop()`.
 */
export const cron = {
  /**
   * Schedule a named cron job. Re-scheduling the same name replaces the old
   * job (and stops it). Returns a handle with `stop()`.
   */
  schedule(
    name: string,
    expression: string,
    task: () => void | Promise<void>,
    options?: { timezone?: string; },
  ): CronHandle {
    return scheduleCron(name, expression, task, options);
  },

  /** Stop every scheduled job (call on app shutdown). */
  stop(): void {
    stopSchedules();
  },
};

function scheduleCron(
  name: string,
  expression: string,
  task: () => void | Promise<void>,
  options?: { timezone?: string; },
): CronHandle {
  jobs.get(name)?.stop();
  const job = new Cron(
    expression,
    {
      timezone: options?.timezone,
      catch: (error: unknown) => console.error(`[scheduler] "${name}" run failed:`, error),
    },
    () => {
      void task();
    },
  );
  jobs.set(name, job);
  return {
    stop() {
      job.stop();
      jobs.delete(name);
    },
  };
}

function stopSchedules(): void {
  for (const job of jobs.values()) job.stop();
  jobs.clear();
}