# Controllers & Bindings

The bindings system is the heart of Deskapp. Every handler you export from a controller becomes callable from the UI as `bindings['<module>.<controller>.<handler>'](...)` over secure IPC.

## How discovery works

1. At boot, `bindAll()` scans controller files under `src/modules/*/controllers/*.controller.ts` via the generated manifest (`src/core/api/bindings.generated.ts`).
2. Each file's `handlers` object is reflected: every entry becomes a binding named `<module>.<controller>.<handler>`.
3. Handlers are registered with Electron's `ipcMain.handle()` as `deskapp:<name>`. The preload script exposes them to the renderer via `contextBridge` as `window.bindings` (flat + nested) and the nested `window.md` alias.

Regenerate the manifest when adding/removing controllers:

```sh
npm run maker bindings:gen
npm run maker codegen  # schema + bindings
```

## Writing a controller

```ts
// ./src/modules/blog/controllers/post.controller.ts

import { db, paginate, validate } from "@/core/facade";
import { posts } from "@/modules/blog/database/models/post.model";

const titleSchema = validate.z.object({ title: validate.z.string().min(3) });

export const list = async (): Promise<Record<string, unknown>> => {
  return await paginate.model({ table: posts, query: db.query.posts });
};

export const create = async (input: unknown): Promise<Record<string, unknown>> => {
  const data = await validate.run(titleSchema, input);
  const [row] = await db.insert(posts).values(data).returning();
  return { ok: true, post: row };
};

export const handlers = { list, create };
```

This creates `bindings['blog.post.list']` and `bindings['blog.post.create']`.

## Calling from the UI

You can call bindings in two forms:

### Flat form (string key)
```ts
// In a Vue component
const rows = await bindings['blog.post.list']();
await bindings['blog.post.create']({ title: 'Hello' });
```

### Nested form with `md` (cleaner, autocompletable)
```ts
const rows = await md.blog.post.list();
await md.blog.post.create({ title: 'Hello' });
```

Both forms work. The `md` global provides a nested object structure for better readability and IDE support. `bindings` remains as a deprecated alias for compatibility.

The bindings are exposed by the preload script. Type declarations live in `src/ui/src/bindings.d.ts`.

## Frontend → backend without CORS

Proxy external requests through a backend controller:

```ts
// ./src/modules/app/controllers/net.controller.ts

export const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, status: res.status, data: await res.json() };
};

export const handlers = { fetchJson };
```

```ts
// ./src/ui/src/pages/example/index.vue (script setup)

const data = await bindings["app.net.fetchJson"]("https://api.example.com/items");
```

To call a server from the **main process**, import the facade helper — `import { http } from "@/core/facade"`, then `await http.get("/api/…", { token })`. The starter also ships generic bindings: `app.net.fetchJson` for any absolute URL and `app.net.apiFetch` for calls against a **runtime base URL** (`API_URL` in `.env`). For the full walkthrough — helper + controller + store + page, auth, offline and dev/prod — see [Calling a Server API](./remote-api).

## The facade

Import framework utilities through `@/core/facade`:

```ts
import {
  win,
  chrome,
  pickers,
  db,
  paginate,
  sql,
  queue,
  cron,
  files,
  storage,
  pass,
  validate,
  chromium,
} from "@/core/facade";
```

- **`win` / `chrome`** - Window management, tray, menus, dialogs
- **`pickers`** - File open/save/folder pickers
- **`db` / `paginate`** - Database and pagination
- **`queue` & `cron`** - Job queue and scheduler
- **`files` / `storage`** - Storage APIs
- **`pass` / `validate`** - Password hashing and validation
- **`chromium`** - Playwright/Chromium utilities

`@/core/facade` is the **framework's** facade. Each module also has its own
`facade.ts` — its public API for other modules. See
[Modules → Cross-module access](./modules.md#cross-module-access-the-facade).
