# `queue` — concurrency

Imported from the facade: `import { queue } from "@/core/facade.ts"`.

Bounded in-process async queue: at most `concurrency` tasks run at once; excess jobs wait. `add(task)` resolves with the task's own result and rejects only that caller when the task throws — other tasks are unaffected. See [Queue](../guide/queue).

## Functions

| Function | Signature | Description |
| --- | --- | --- |
| `create` | `<T>(options?: { concurrency?: number }) => Queue<T>` | New queue running at most `concurrency` (default `1`) tasks in parallel. |

## Types

```ts
interface Queue<T> {
  add(task: () => Promise<T>): Promise<T>; // resolves with the task's result
  readonly size: number;                   // pending (waiting) jobs
  readonly running: number;                // jobs executing right now
}
```

## Use cases

### Throttle a fan-out (email/notification blast)

`concurrency: 3` sends at most three at a time; `add` resolves with each job's own result.

```ts
import { queue } from "@/core/facade.ts";

const mailer = queue.create<string>({ concurrency: 3 });

const jobs = recipients.map((to) =>
  mailer.add(async () => {
    await sendEmail(to);
    return to;
  }),
);
const results = await Promise.all(jobs); // "sent" statuses, in order
```

Results come back in submission order. To expose the queue to a UI, wrap a job submission in a controller + binding (`<module>.<controller>.<handler>`) and call it from the frontend in-process.

> Full end-to-end pattern (SQLite list + queue + SMTP + cron): see [Email a list stored in SQLite](../api/index#email-a-list-stored-in-sqlite).

### Strictly serial operations (one writer at a time)

`concurrency: 1` guarantees ordering — perfect for appending to a single file or a shared resource.

```ts
const logWriter = queue.create({ concurrency: 1 });

for (const line of lines) {
  await logWriter.add(() => appendLine(logPath, line)); // never interleaved
}
```

### Parallel image/asset processing

Size the pool to the machine; `Promise.allSettled` so one failure doesn't abort the batch.

```ts
const pool = queue.create<string>({ concurrency: navigator.hardwareConcurrency || 4 });
const results = await Promise.allSettled(
  images.map((img) => pool.add(() => convertAndSave(img))),
);
const failed = results.filter((r) => r.status === "rejected");
```

### Isolate failures per caller

A throwing job rejects **only** its own `add` promise — the rest of the queue keeps running.

```ts
const q = queue.create();
try {
  await q.add(() => riskyOperation());
} catch (err) {
  // only this caller sees the error; other queued jobs are unaffected
}
```

### Watch queue pressure

`size` / `running` let you surface backpressure to the UI or log it.

```ts
setInterval(() => {
  if (pool.size > 100) console.warn(`queue backed up: ${pool.size} waiting, ${pool.running} running`);
}, 10_000);
```

## Notes

- `concurrency` is floored at `1`. There is no per-job timeout — your tasks must resolve or reject.
- Use for throttled jobs: image processing, API fan-out, file conversion.