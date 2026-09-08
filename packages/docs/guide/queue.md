# Queue

A bounded in-process job queue lives at `src/core/utils/queue.ts` and is exposed through the facade:

```ts
import { queue } from "@/core/facade.ts";

const q = queue.create({ concurrency: 2 });
```

## API

The created queue is an object with:

| Member | Description |
| --- | --- |
| `q.add(fn)` | Enqueue a job `() => Promise<T>` or `() => T`. Resolves with the job's value; rejects only that caller. |
| `q.size` | Number of jobs waiting to run. |
| `q.running` | Number of jobs currently executing. |

Jobs run sequentially up to `concurrency`; the queue never exceeds that budget.

## Exposing the queue to a UI

Wrap a submission in a controller + binding so the frontend can enqueue work in-process:

```ts
// controller: <module>.jobs.submit
import { queue } from "@/core/facade.ts";

export const submit = (opts?: { items?: string[]; concurrency?: number; delayMs?: number }) => {
  const jobs = opts?.items ?? ["a", "b", "c"];
  return queue.run({ concurrency: opts?.concurrency ?? 2, tasks: jobs.map((item) => async () => item) });
};

export const handlers = { submit };
```

```ts
// UI — calls the backend in-process, results come back as plain JSON
const result = await bindings["<module>.jobs.submit"]({ items: ["a", "b", "c"], concurrency: 2 });
```