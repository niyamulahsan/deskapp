# API Reference

Every reusable framework capability is exposed through **one import** — the facade at `@/core/facade.ts` — as a namespace object. You never reach into core internals; if it is not on this page, it is not part of the public API.

```ts
import {
  win, chrome, pickers,
  db, paginate, sql,
  queue, cron,
  files, storage,
  pass, validate,
  chromium,
} from "@/core/facade.ts";
```

| Namespace | Purpose | Guide |
| --- | --- | --- |
| [`win`](./win) | Desktop window lifecycle | [Windows](../guide/windows) |
| [`chrome`](./chrome) | Tray, menus, dialogs, chrome setup | [Windows](../guide/windows) |
| [`pickers`](./pickers) | Native open / save / folder dialogs | [Windows](../guide/windows) |
| [`db`](./db) | Drizzle connection + query | [Database](../guide/database) |
| [`paginate`](./paginate) | [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination | [Database](../guide/database) |
| [`queue`](./queue) | Bounded async job queue | [Queue](../guide/queue) |
| [`cron`](./cron) | Named cron schedules | [Scheduler](../guide/scheduler) |
| [`chromium`](./chromium) | Chromium binary + extension resolution | [Playwright](../guide/playwright) |
| [`pass`](./pass) | bcrypt hashing | [Password](../guide/password) |
| [`validate`](./validate) | Zod schemas + runner | [Validation](../guide/validation) |
| [`files`](./files) | Operate on any path the user picks | [Storage](../guide/storage) |
| [`storage`](./storage) | The app's own private/tmp state | [Storage](../guide/storage) |

## When do I use which?

- **Windows & desktop** — `win` drives your windows; `chrome` adds the menu/tray/native dialogs; `pickers` gets real OS open/save/folder dialogs.
- **Data** — `db` is the Drizzle client; `paginate` wraps it in a [nexgen](https://niyamulahsan.github.io/nexgen/)-style page; `sql` writes `where` filters.
- **Background work** — `queue` throttles async jobs; `cron` runs named schedules and stops them all on shutdown.
- **Security & input** — `pass` hashes passwords; `validate` runs schemas and throws a structured 422-shaped failure.
- **Files** — `files` touches the user's real file system anywhere; `storage` keeps the app's own state in `private`/`tmp` disks.
- **Automation** — `chromium` locates the bundled browser binary and unpacked extensions for Playwright.

## Common recipes — combining namespaces

Real features rarely use one namespace. Here is the pattern for a very common case, so you can see how the pieces fit.

### Email a list stored in SQLite

Deskapp has **no built-in mailer** — add a third-party SMTP client and drive it with the facade: `db` reads the list, `queue` throttles the sends so the SMTP server is never flooded, `cron` schedules the blast, and `db` records the result per row.

Add the SMTP client (example uses nodemailer):

```sh
deno add npm:nodemailer
```

A tiny mailer service around it:

```ts
// src/core/utils/mailer.ts
import nodemailer from "npm:nodemailer";
import { validate } from "@/core/facade.ts";

const opts = validate.run(validate.z.object({ host: validate.z.string(), port: validate.z.coerce.number().int() }), {
  host: Deno.env.get("SMTP_HOST"),
  port: Deno.env.get("SMTP_PORT"),
});

const transport = nodemailer.createTransport({
  host: opts.host,
  port: opts.port,
  secure: true,
  auth: { user: Deno.env.get("SMTP_USER"), pass: Deno.env.get("SMTP_PASS") },
});

export async function sendEmail(to: string, subject: string, body: string) {
  return transport.sendMail({ from: Deno.env.get("SMTP_FROM") ?? "noreply@example.com", to, subject, text: body });
}
```

The controller that sends to the whole list:

```ts
import { db, queue, sql } from "@/core/facade.ts";
import * as schema from "@/database/schema.ts";
import { sendEmail } from "@/core/utils/mailer.ts";

export const blast = async (input: { subject: string; body: string }) => {
  // 1) read the mailing list from SQLite
  const subscribers = await db.query.users.findMany({
    where: (t, { eq }) => eq(t.newsletterOptIn, true),
  });

  // 2) throttle: at most 3 SMTP calls in flight at once
  const mailer = queue.create<string>({ concurrency: 3 });

  const results = await Promise.allSettled(
    subscribers.map((user) =>
      mailer.add(async () => {
        await sendEmail(user.email, input.subject, input.body);
        // 3) record who actually got it
        await db.update(schema.users)
          .set({ lastNewsletterAt: new Date().toISOString() })
          .where(sql`id = ${user.id}`);
        return user.email;
      }),
    ),
  );

  return {
    ok: true,
    total: subscribers.length,
    sent: results.filter((r) => r.status === "fulfilled").length,
  };
};
```

Optional: send it on a schedule instead of on demand.

```ts
cron.schedule("newsletter", "0 9 * * 1", () => void blast({ subject: "Weekly digest", body: "..." }));
```

Which pieces did you just use? [`db`](./db) (read + write), [`queue`](./queue) (throttle + per-caller error isolation), [`sql`](./db) (filter/update), [`validate`](./validate) (safe env config), [`cron`](./cron) (schedule). That is the whole point of the facade — compose instead of re-implement.

## Rules of the facade

- **Everything is a namespace object** — import `win`, not a bare `openWindow`. Grouping makes the code searchable and collisions impossible.
- **Desktop-only items degrade gracefully** — `win.createWindow`, `chrome.createTray` etc. return `undefined` (not throw) when not running under `deno desktop`.
- **Nothing here needs network access** — all utilities are in-process.
- **Exports stay truthful** — the facade only re-exports what is implemented. If a signature is missing here, it does not exist yet.