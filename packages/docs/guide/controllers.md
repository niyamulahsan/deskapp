# Controllers & Bindings

The bindings system is the heart of Deskapp. Every handler you export from a controller becomes callable from the UI **in-process** as `bindings['<module>.<controller>.<handler>'](...)`.

## How discovery works

1. At boot, `bindAll(window)` scans for controller files: it walks `src/modules/*/controllers/*.controller.ts` (using `src/core/api/bindings.generated.ts` as the fast path when present, with a filesystem walk as fallback).
2. Each file's `handlers` object is reflected: every `key: value` becomes a binding named `<module>.<filebasename>.<key>`.
3. `window.bind(name, handler)` registers it on the `Deno.BrowserWindow`, so the webview's `bindings` Proxy resolves it and returns a Promise.

Keep the manifest fresh:

```sh
deno task maker bindings:gen  # regenerate src/core/api/bindings.generated.ts
deno task maker codegen       # schema + bindings
```

`dev` / `serve` run codegen automatically.

## Writing a controller

```ts
// src/modules/blog/controllers/post.controller.ts
import { db, paginate, validate } from "@/core/facade.ts";
import * as schema from "@/database/schema.ts";

const titleSchema = validate.z.object({ title: validate.z.string().min(3) });

export const list = async (): Promise<Record<string, unknown>> => {
  return await paginate.model({ table: schema.posts, query: db.query.posts });
};

export const create = async (input: unknown): Promise<Record<string, unknown>> => {
  const data = await validate.run(titleSchema, input);      // throws 422 envelope
  const [row] = await db.insert(schema.posts).values(data).returning();
  return { ok: true, post: row };
};

export const handlers = { list, create };
```

`post.controller.ts` → `bindings['blog.post.list']`, `bindings['blog.post.create']`.

## Calling from the UI

The `bindings` global is typed as a vendored index — no per-binding files to maintain:

```ts
// src/ui/src/components/Posts.vue (ts)
const rows = await bindings['blog.post.list']();
await bindings['blog.post.create']({ title: 'Hello' });
```

The type declaration lives at `src/ui/src/bindings.d.ts` (`const bindings: Bindings`), where `Bindings[name]` is `(...args: unknown[]) => Promise<unknown>`.

::: warning
The webview knows `bindings` only when running under `deno desktop`. During a plain Vite dev server session `bindings` is `undefined` — guard or fall back accordingly.
:::

## Frontend → backend without CORS

The webview's own `fetch()` can be blocked by CORS on cross-origin APIs. Proxy the request through a backend controller instead — the backend has no CORS restrictions:

```ts
// controller: <module>.net.fetchJson
import { app } from "@std/http/server";   // or fetch directly with Deno/undici

export const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, status: res.status, data: await res.json() };
};

export const handlers = { fetchJson };
```

```ts
// UI
const data = await bindings["<module>.net.fetchJson"]("https://api.example.com/items");
```

## The facade — import everything from one place

Controllers (and jobs, schedules, models) import framework utilities through `@/core/facade.ts`, not internal paths. Each capability is a **namespace object** — `win`, `db`, `queue`, `files`, … — so it's clear which import belongs to which area:

```ts
import {
  // Windows ── DesktopWindow lifecycle
  win,
  // Native chrome ── tray, menus, dialogs
  chrome,
  // File pickers
  pickers,
  // Database ── connection + query
  db,
  // Pagination + where-filters
  paginate, sql,
  // Concurrency + cron
  queue, cron,
  // Files ── user-file layer
  files, storage,
  // Security + validation
  pass, validate,
  // Playwright / Chromium
  chromium,
} from "@/core/facade.ts";

await win.openWindow("settings");                 // win: createWindow/getWindow/openWindow
chrome.confirmDialog("Are you sure?");            // chrome: tray, menus, dialogs, chrome setup
const path = await pickers.open();                // pickers: open/save/folder
await db.init();                                  // db: init/close + query
await paginate.model({ table, query });           // paginate: query/table/model + sql
queue.create({ concurrency: 2 });                 // queue: create
cron.schedule("tick", "* * * * * *", task);       // cron: schedule/stop
await files.writeTextFile(path, data);            // files: user-file layer
await pass.hashPassword("secret");                // pass: hashPassword/verifyPassword
await validate.run(schema, input);                // validate: run + z (schema builder)
chromium.resolve();                               // chromium: resolve/candidates/extensions
```

- **`win`** & **`chrome`** (tray/menu/dialog) → `src/window/`
- **`pickers`** → `src/window/dialogs.ts`
- **`db` / `paginate`** → `src/core/database/`
- **`queue` & `cron`** → `src/core/utils/queue.ts`, `src/core/utils/scheduler.ts`
- **`files` / `storage`** → `src/core/utils/storage.ts`
- **`pass` / `validate`** → `src/core/utils/password.ts`, `src/core/utils/validation.ts`
- **`chromium`** → `src/core/utils/playwright.ts`

Only what's implemented is re-exported, so the surface stays truthful.