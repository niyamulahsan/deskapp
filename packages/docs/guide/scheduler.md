# Scheduler

Cron scheduling is powered by [croner](https://croner.github.io/) through `src/core/utils/scheduler.ts`, exposed via the facade:

```ts
import { cron } from "@/core/facade.ts";

cron.schedule("cleanup", "0 4 * * *", () => {
  console.log("daily cleanup");
});
```

## API

| Function | Description |
| --- | --- |
| `cron.schedule(name, expression, fn, options?)` | Register a named cron job. Returns a handle with only `stop()`. Re-scheduling the **same name replaces the old job** (and stops it). Options accept `{ timezone? }`. |
| `cron.stop()` | Stop **all** registered cron jobs (called on app shutdown). |

The returned handle's `stop()` also de-registers the job so it won't be stopped twice at shutdown.

## Exposing the scheduler to a UI

Register a job in a controller + binding and report its state through a handler:

```ts
// controller: <module>.monitor.start
import { cron } from "@/core/facade.ts";

export const start = () => {
  let ticked = 0;
  const handle = cron.schedule("app.tick", "* * * * * *", () => { ticked += 1; });
  return { ok: true, name: "app.tick", expression: "* * * * * *", handle };
};

export const handlers = { start };
```

```ts
// UI
const result = await bindings["<module>.monitor.start"]();
// { ok: true, name: "app.tick", expression: "* * * * * *", ... }
```

The demo stops its own schedule before returning (`job.stop()`), leaving no dangling cron.