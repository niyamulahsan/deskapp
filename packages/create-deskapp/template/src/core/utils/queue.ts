/**
 * queue.ts - reusable in-process async queue.
 *
 * Bounded concurrency; `add(task)` resolves with the task's own result and
 * rejects only that caller when the task throws (other tasks unaffected).
 * Import via the facade: `import { queue } from "@/core/facade.ts"`.
 */

export type QueueTask<T> = () => Promise<T>;

interface Pending<T> { task: QueueTask<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void; }

export interface Queue<T> {
  add(task: QueueTask<T>): Promise<T>;
  readonly size: number;
  readonly running: number;
}

/**
 * Queue namespace - create bounded-concurrency async queues through the
 * facade: `const q = queue.create({ concurrency: 3 })`.
 */
export const queue = {
  create<T>(options?: { concurrency?: number; }): Queue<T> {
    return createQueue<T>(options);
  },
};

function createQueue<T>(options?: { concurrency?: number; }): Queue<T> {
  const concurrency = Math.max(1, options?.concurrency ?? 1);
  const pending: Pending<T>[] = [];
  let running = 0;

  const tick = (): void => {
    while (running < concurrency && pending.length > 0) {
      const entry = pending.shift()!;
      running += 1;
      entry.task().then(entry.resolve, entry.reject).finally(() => {
        running -= 1;
        tick();
      });
    }
  };

  return {
    add(task: QueueTask<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending.push({ task, resolve, reject });
        tick();
      });
    },
    get size() {
      return pending.length;
    },
    get running() {
      return running;
    },
  };
}