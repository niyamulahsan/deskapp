# `cron` — scheduling

Imported from the facade: `import { cron } from "@/core/facade.ts"`.

Named cron schedules backed by [croner](https://croner.github.io/). Jobs are unique by name — re-scheduling the same name stops and replaces the old job. See [Scheduler](../guide/scheduler).

## Functions

| Function | Signature | Description |
| --- | --- | --- |
| `schedule` | `(name: string, expression: string, task: () => void \| Promise<void>, options?: { timezone?: string }) => CronHandle` | Register a named cron job (replacing any existing job with the same name) and return a handle. |
| `stop` | `() => void` | Stop **all** registered jobs (call on app shutdown). |

## Types

```ts
interface CronHandle { stop(): void; }
```

## Use cases

### Daily maintenance at a fixed hour

Standard 5-field cron expression; `timezone` makes the wall-clock time predictable across machines.

```ts
import { cron } from "@/core/facade.ts";

cron.schedule("cleanup", "0 4 * * *", async () => {
  await clearTempFiles();
  await vacuumDatabase();
}, { timezone: "UTC" });
```

### Live heartbeat / UI ticker

Second-level expressions update a shared counter the UI polls or reads via bindings.

```ts
let tickCount = 0;
cron.schedule("demo.tick", "* * * * * *", () => {
  tickCount += 1;
});
```

To report a tick to the UI, register the counter on the backend and expose a read handler via a controller + binding (`<module>.<controller>.<handler>`).

### Periodic background sync (every N minutes)

Register once at boot; the task runs as long as the app is alive.

```ts
cron.schedule("sync", "*/5 * * * *", async () => {
  await syncRemoteChanges();
});
```

### Replace a job when settings change (named slots)

The same `name` replaces the old job — so re-applying user settings never double-schedules.

```ts
function applyReportHour(hour: number) {
  cron.schedule("report", `0 ${hour} * * *`, () => generateDailyReport());
}

// user changes the hour → just re-apply (old "report" job is stopped & replaced)
applyReportHour(9);
```

### Stop everything on shutdown

Call `cron.stop()` during app teardown (also already done via `db.close()` shuts down paths).

```ts
// in app shutdown
cron.stop();
```

## Notes

- Failing tasks are caught and logged (scheduler does not crash the app).
- Use `name` to make a job replaceable — the same name = the same job slot, so re-running setup never double-schedules.