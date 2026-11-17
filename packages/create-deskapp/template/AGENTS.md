# AGENTS.md — deskapp

You are working in a **deskapp** application: a desktop app built on **Electron**
(the main process is your backend), a **Vue 3** renderer, and **Drizzle + SQLite**.
This file is the contract. Read it before writing any code and follow it exactly.
**A change that breaks a rule is wrong even if it compiles and every test passes.**

- Docs: https://niyamulahsan.github.io/deskapp/
- AI index (one file, every page): https://niyamulahsan.github.io/deskapp/llms.txt
- Full docs (single file): https://niyamulahsan.github.io/deskapp/llms-full.txt
- Conventions: https://niyamulahsan.github.io/deskapp/guide/conventions
- Modules: https://niyamulahsan.github.io/deskapp/guide/modules
- Controllers & bindings: https://niyamulahsan.github.io/deskapp/guide/controllers
- Database: https://niyamulahsan.github.io/deskapp/guide/database
- UI & gum: https://niyamulahsan.github.io/deskapp/guide/gum
- Testing: https://niyamulahsan.github.io/deskapp/guide/testing
- Facade / API reference: https://niyamulahsan.github.io/deskapp/api/

If a rule here conflicts with something you "know" from another framework, this
file wins. If a rule here conflicts with the linked docs, the docs win — report
the discrepancy, do not silently pick one.

## 0. Non-negotiables

These override every other habit. A change that breaks one of them is wrong even
if it compiles and every test passes.

1. **Never edit `src/core/**`.** It is the framework, not your application. Your
   code lives in `src/modules/**`, `src/config/**`, `src/ui/**`, `src/main.ts`
   and `src/preload.ts`. `src/window/**` is framework internals too — consume it
   through the facade — **except** the desktop-chrome files
   `src/window/app-menu.ts`, `src/window/context-menu.ts` and `src/window/tray.ts`,
   which are the intended place to customize the app menu, right-click menu and
   tray.
2. **Never hand-edit generated files.** These are produced by the maker and are
   overwritten without warning:
   - `src/core/api/bindings.generated.ts` (`npm run maker -- bindings:gen`)
   - `src/database/schema.ts` (`npm run maker -- db:schema`)
   - `src/database/migrations/**` (`npm run maker -- db:generate`)
   Regenerate them with the command instead.
3. **Directory = meaning.** The framework discovers code by folder, never by a
   manifest you maintain by hand. Controllers are only discovered as
   `src/modules/<module>/controllers/<controller>.controller.ts` (files must end
   in `.controller.ts`). Models live in `database/models/`, seeders in
   `database/seeders/`, tests in `__tests__/`. A file anywhere else is invisible.
4. **Every controller must export a `handlers` map.** A handler that is not in
   `handlers` is never registered and can never be called from the UI. The
   registry reads exactly this map.
5. **Import framework utilities from `@/core/facade`.** Do not reach into
   `@/core/**` internals from app modules. (The framework's own sample
   controllers occasionally import a deep helper the facade does not expose,
   e.g. `ensurePlaywrightBrowser` from `@/core/utils/playwright` — treat that as
   an exception, never a pattern. If you need something, prefer the facade.)
6. **The renderer never imports backend code.** `src/ui/**` must not import
   `@/core/**`, `@/modules/**`, `electron`, `node:*`, or `drizzle-orm`. The UI
   reaches the backend **only** through `bindings`/`md`. The backend must not
   import from `src/ui/**` either.
7. **Every source file opens with its location header on line 1, then one blank
   line.** The header is `// ./<path-from-project-root>`, e.g.
   `// ./src/modules/blog/controllers/post.controller.ts`; a Vue SFC uses the HTML
   form, e.g. `<!-- ./src/ui/src/pages/dashboard/index.vue -->`. Keep it in place —
   never remove it and never add a second one. `maker` writes it on every file it
   scaffolds.
8. **After adding or removing a controller, run `npm run maker -- bindings:gen`**
   (or `npm run maker -- codegen` for schema + bindings). Packaged builds read
   the generated manifest; an un-regenerated binding does not exist at runtime.

## 1. Project layout

```
src/
  main.ts                         # Electron main entry — boots env, db, storage, bindings, windows
  preload.ts                      # contextBridge: exposes bindings/md to the renderer
  config/
    app.ts                        # app identity (name, productName, appId, protocol) — edit this
    winsetup.ts                   # window presets + dev-tools mode + chrome flags — edit this
  modules/                        # YOUR application code
    <module>/
      facade.ts                   # public API of the module (cross-module imports)
      controllers/
        <name>.controller.ts      # named handlers + `handlers` map  (required to be callable)
        <name>.schema.ts          # Zod schemas + inferred `<X>Type` for that controller
      database/
        models/<name>.model.ts    # Drizzle sqlite table
        seeders/<name>.seed.ts    # default-export seeder (+ `table`)
      __tests__/<name>.test.ts    # Vitest
  core/                           # framework internals — DO NOT EDIT
    facade.ts                     # the public API surface you import from
    api/registry.ts               # binds handlers to ipcMain
    api/bindings.generated.ts     # GENERATED — controller manifest
    database/{connection,paginate,config,...}.ts
    utils/{queue,scheduler,storage,validation,password,playwright}.ts
    maker/**                      # the `npm run maker` CLI
  window/                         # window manager / native chrome / dialogs
    app-menu.ts, context-menu.ts, tray.ts  # menu & tray — edit these to customize desktop chrome
  database/
    schema.ts                     # GENERATED — aggregates every model
    migrations/                   # GENERATED
  storage/                        # runtime storage root (git-ignored; CLI/dev fallback)
  ui/                             # the Vue 3 renderer
    vite.config.ts
    tsconfig.json
    src/
      app.ts                      # createApp + plugins (head, Pinia, Pulse, Gum, router)
      App.vue                     # <router-view/>
      router/index.ts             # routes
      pages/<name>/index.vue      # pages
      components/                 # shared components (DataTable lives here)
      stores/<name>.ts            # Pinia stores
      plugins/{gum,pulse}.ts      # request/form helper + realtime
      bindings.d.ts, env.d.ts, global.d.ts
      assets/
drizzle.config.ts                 # drizzle-kit config (mirrors the runtime DB path)
vitest.config.ts, biome.json, tsconfig.json, package.json
```

## 2. Module anatomy

A module is a self-contained feature under `src/modules/<name>/`. Create one with:

```sh
npm run maker make:module blog          # module + model + seeder + controller + schema + facade
npm run maker make:controller blog Post # add another controller (+ schema) to a module
npm run maker make:model blog Post      # add a model
npm run maker make:seeder blog Post     # add a seeder (model must already exist)
npm run maker make:test blog Post       # add a Vitest file under __tests__/
```

Names are lower-cased by the maker. A model named `Post` produces
`database/models/post.model.ts` exporting a table variable `posts` with the SQL
table name `posts`. The same lower-cased `<name>` is the controller key, so
`make:controller blog Post` binds handlers under `blog.post.<handler>`.

Rules:

- One concern per file. A controller file exports handlers **and** the `handlers`
  map; schemas go in the sibling `<name>.schema.ts`.
- The module folder name is the binding namespace. `src/modules/blog/...` binds as
  `blog.<controller>.<handler>`.
- **Cross-module access goes through the module's `facade.ts`.** Import from
  `@/modules/<other>/facade`, never from its `controllers/` or `database/`
  directly. The facade re-exports the pieces other modules may depend on — the
  module's controller handlers and its model(s). The one exception is a Drizzle
  `relations()` reference to another module's model, which may import the model
  file directly.
- Facade rules: a module **never** imports its own facade, and a facade **never**
  imports another facade. `make:module` scaffolds it as a namespace re-export of
  the module's controller plus its model:
  `export * as <module> from "./controllers/<module>.controller"` and
  `export * from "./database/models/<module>.model"`. Add another namespace line
  (`export * as post from "./controllers/post.controller"`) for each extra
  controller other modules may use.

## 3. Controllers & bindings

A controller is a file that exports named handlers plus a `handlers` map. The
registry (`src/core/api/registry.ts`) reads the generated manifest, takes each
controller's `handlers`, and registers every entry with Electron's `ipcMain` as
`deskapp:<module>.<controller>.<handler>`. The preload then exposes it to the
renderer as `bindings['<module>.<controller>.<handler>'](...)` and, nested, as
`md.<module>.<controller>.<handler>(...)`.

Canonical shape (this is exactly what `make:controller` generates):

```ts
// ./src/modules/blog/controllers/post.controller.ts

import { validate } from "@/core/facade";
import { CreatePostSchema, PostIdParamsSchema, UpdatePostSchema } from "@/modules/blog/controllers/post.schema";

export const index = async () => {
  return { message: "post list fetched successfully", data: [] };
};

export const show = async (params: unknown) => {
  const { id } = await validate.run(PostIdParamsSchema, params);
  return { message: "post fetched successfully", data: { id, name: "" } };
};

export const store = async (body: unknown) => {
  await validate.run(CreatePostSchema, body);
  return { message: "post created successfully" };
};

export const update = async (input: { params: unknown; body: unknown }) => {
  await validate.run(PostIdParamsSchema, input.params);
  await validate.run(UpdatePostSchema, input.body);
  return { message: "post updated successfully" };
};

export const destroy = async (params: unknown) => {
  await validate.run(PostIdParamsSchema, params);
  return { message: "post deleted successfully" };
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = { index, show, store, update, destroy };
```

Rules:

- Handlers receive **plain JSON args** (everything crosses IPC). Validate and
  narrow `unknown` before using it.
- Return JSON-serializable values. Never return a Drizzle row with non-plain
  fields, an Electron object, or a `File` — shape the payload first.
- Prefer the conventional handler names `index` / `show` / `store` / `update` /
  `destroy`; `gum` and `DataTable` assume this payload contract (see §11).
- Calling from the renderer — both forms are equivalent:

  ```ts
  const rows = await bindings["blog.post.index"]();      // flat (typed via bindings.d.ts)
  const rows2 = await md.blog.post.index();               // nested (nicer, untyped)
  ```

- `bindings` is the documented global; `md` is the nested alias. Types for
  `bindings` live in `src/ui/src/bindings.d.ts` (it does not type `md`).
- The preload also exposes `bindings.__invoke(name, ...args)` as a fallback for
  any name — treat it as an escape hatch, not the normal path.
- Adding/removing a controller is **not** live until you regenerate the manifest:
  `npm run maker -- bindings:gen`, then restart Electron.

## 4. Schemas & validation

Schemas are Zod and are the **single source of truth for input and its type**.
Put them in the controller's sibling `<name>.schema.ts`. Every schema is paired
with its inferred type on the next line — `z.input` for a request shape (a
`.default()` field stays optional), `z.infer` for a response shape:

```ts
// ./src/modules/blog/controllers/post.schema.ts

import { z } from "zod";

export const CreatePostSchema = z.object({ name: z.string().min(1) });
export type CreatePostType = z.input<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({ name: z.string().min(1) });
export type UpdatePostType = z.input<typeof UpdatePostSchema>;

export const PostIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export type PostIdParamsType = z.input<typeof PostIdParamsSchema>;
```

- Name the pair `<X>Schema` / `<X>Type`. Import the `*Type` wherever a shape is
  needed — a controller, a store, a helper — instead of re-declaring a body,
  params or query by hand.

Run them with the facade's `validate`:

```ts
import { validate } from "@/core/facade";

const data = await validate.run(CreatePostSchema, body); // returns parsed, typed data
```

- `validate.z` is a re-export of Zod, so `validate.z.object({ ... })` also works
  if you prefer not to import `z` directly. Pick one and stay consistent within a
  file.
- `validate.run(schema, input)` is **async** and **throws** on failure:

  ```ts
  { status: 422, message: "Validation failed",
    errors: { formErrors: [], fieldErrors: { email: ["Invalid email"] } } }
  ```

  `errors` is Zod's `result.error.flatten()`. `gum` normalizes exactly this shape
  into per-field form errors (see §11), so **always validate with `validate.run`**
  rather than calling `schema.parse` yourself.
- Never trust IPC input. Validate ids (`z.coerce.number()...`) and bodies at the
  top of every handler that reads them.

## 5. Database, models, seeders & pagination

`db` is the Drizzle client for SQLite (libsql). `src/main.ts` calls `db.init()`
at boot; `db.close()` runs on shutdown. Calls before `init()` throw.

Models use `drizzle-orm/sqlite-core`:

```ts
// ./src/modules/blog/database/models/post.model.ts

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default("current_timestamp"),
  updatedAt: text("updated_at").notNull().default("current_timestamp"),
});
```

Import a table directly from its module in app code:

```ts
import { db, sql } from "@/core/facade";
import { posts } from "@/modules/blog/database/models/post.model";

await db.insert(posts).values({ name: "Hello" }).returning();
const rows = await db.select().from(posts).where(sql`name = ${name}`);
const one = await db.query.posts.findFirst({ where: (t, { eq }) => eq(t.id, id) });
```

`src/database/schema.ts` is the **generated aggregate** of every model. Do not
edit it; regenerate with `npm run maker -- db:schema`. The `import * as schema`
form is the whole-schema view used by the framework — app code imports tables
directly.

Seeders are default-exported functions with a `table` export (used for FK
ordering):

```ts
// ./src/modules/blog/database/seeders/post.seed.ts

import { db } from "@/core/database/connection";
import { posts } from "@/modules/blog/database/models/post.model";

export const table = posts;

export default async function PostSeeder() {
  const rows: (typeof posts.$inferInsert)[] = [/* ... */];
  for (const row of rows) await db.insert(posts).values(row);
}
```

Pagination is nexgen-style via the facade's `paginate` (and `sql` for `where`).
All three methods return the **same envelope**:

```ts
type PaginatedResult<T> = {
  current_page: number; data: T[]; first_page_url: string | null; from: number | null;
  last_page: number; last_page_url: string | null; next_page_url: string | null;
  path: string; per_page: number; prev_page_url: string | null; to: number | null; total: number;
};
```

| Use                                              | Method                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Whole table, optional `where`/`orderBy`          | `paginate.table(posts, { page, perPage, where, orderBy, path })`        |
| Eager-loaded relations (`db.query.<t>`)          | `paginate.model({ table, query: db.query.posts, with, columns, path })` |
| Full control (`total()` + `data(limit, offset)`) | `paginate.query({ total, data, path })`                                 |

`page`/`perPage` are normalized and clamped (`perPage` default 15, `maxPerPage`
default 100). A list handler that the UI can bind to looks like:

```ts
export const table = async (opts?: { page?: number; size?: number }) => {
  return paginate.model({
    page: opts?.page,
    perPage: opts?.size,
    path: "blog.post.index",
    table: posts,
    query: db.query.posts,
  });
};
```

Database commands (all via the maker):

```sh
npm run maker db:schema          # regenerate src/database/schema.ts from models
npm run maker db:generate        # schema + migration SQL (does not apply)
npm run maker db:migrate --seed  # generate + run migrations + hooks (+ seeders)
npm run maker db:migrate:module blog   # migrate one module's models
npm run maker db:fresh --seed    # wipe + migrate + hooks + seed
npm run maker db:seed            # run seeders (auto FK-ordered), --module <name> for one
npm run maker db:status          # list generated migrations
npm run maker db:studio          # Drizzle Studio GUI
```

The SQLite file: runtime default is `<userData>/<app-kebab>.sqlite`;
`drizzle.config.ts` mirrors this with a `./src/storage/<app-kebab>.sqlite`
fallback for CLI/dev. `DATABASE_URL` overrides both.

## 6. The facade

`src/core/facade.ts` is the **only** surface app modules import framework code
from. Everything is re-exported there:

| Export                         | What it is                                     |
| ------------------------------ | ---------------------------------------------- |
| `db`                           | Drizzle client + `db.init()` / `db.close()`    |
| `paginate`, `sql`              | nexgen-style pagination + Drizzle `sql` helper |
| `validate`                     | Zod re-export (`validate.z`) + `validate.run`  |
| `pass`                         | `hashPassword` / `verifyPassword` (bcrypt)     |
| `queue`                        | Bounded in-process async queue                 |
| `cron`                         | Named cron schedules (croner)                  |
| `storage`                      | App-managed disks (`private` / `tmp`)          |
| `files`                        | User-file layer (any picked absolute path)     |
| `pickers`                      | Native open / save / folder dialogs            |
| `alertDialog`, `confirmDialog` | Native message dialogs (async)                 |
| `win`                          | Window lifecycle                               |
| `chrome`                       | Menus, tray, native chrome                     |
| `chromium`                     | Playwright/Chromium locator                    |

```ts
import { db, paginate, sql, validate, pass, queue, cron, storage, files, pickers, win, chrome } from "@/core/facade";
```

Rule: **new app code imports from `@/core/facade`.** Do not import
`@/core/database/connection`, `@/core/utils/queue`, etc. directly in a module.
The facade only exports what is implemented, so if it is not there, ask whether
you need it at all before reaching past it.

`@/core/facade` is the **framework's** public API. Each app module has its own
`facade.ts` as well (see §2) — that is the **module's** public API, the one other
modules import from.

## 7. Queue & scheduler

**Queue** — bounded concurrency. `add(task)` resolves with the task's own result;
a throwing task rejects only its own caller, never the queue.

```ts
import { queue } from "@/core/facade";

const q = queue.create<string>({ concurrency: 3 }); // concurrency floored at 1
const results = await Promise.all(items.map((x) => q.add(async () => doWork(x))));
q.size;    // pending
q.running; // executing now
```

**Cron** — named schedules backed by `croner`. The same `name` replaces (stops and
recreates) the previous job, so re-applying settings never double-schedules.

```ts
import { cron } from "@/core/facade";

const job = cron.schedule("cleanup", "0 4 * * *", async () => { /* ... */ }, { timezone: "UTC" });
job.stop();   // stop this job
cron.stop();  // stop ALL jobs (call on shutdown)
```

- Failing tasks are caught and logged; a bad task never crashes the app.
- Register schedules once at boot (or replace them by name) — do not schedule the
  same logical job under different names.

## 8. Storage & files

Two layers, both from the facade.

**`files`** operates on the user's real filesystem — any absolute path a picker
returns. All writes are atomic (temp + rename).

```ts
import { files, pickers } from "@/core/facade";

const src = await pickers.open({ title: "Import", filter: "CSV (*.csv)|*.csv" });
if (!src) return;                       // user cancelled — always check for null
const text = await files.readTextFile(src);
const meta = await files.fileMeta(src); // { path, size, modifiedAt, isFile, isDirectory } | null
await files.writeJson("/tmp/out.json", { ok: true });
```

Read helpers (`readTextFileOr`, `readJson`, `fileMeta`) return fallbacks/`null`
instead of throwing; write helpers create parent folders.

**`storage`** is the app's **own** state, sandboxed to a disk root
(`<userData>/storage`, or `<project>/src/storage/app` in CLI/dev; override with
`APP_DATA_DIR`). `private` survives restarts; `tmp` is transient. Top-level
methods target `private`.

```ts
import { storage } from "@/core/facade";

await storage.init();                       // once at boot (done in main.ts)
await storage.put("settings.json", JSON.stringify(settings));
const bytes = await storage.get("settings.json");
await storage.disk("tmp").put("cache/1.json", "{}");
storage.path("settings.json");              // absolute path
```

- Never build app-state paths by hand; use `storage` (it rejects paths that
  escape the disk root) or `files` (for user paths).
- Expose storage to the UI through a controller + binding — the renderer has no
  filesystem access.

## 9. Windows, chrome, dialogs & pickers

All from the facade. `main.ts` already creates the windows declared in
`src/config/winsetup.ts`, so app code usually **drives** windows rather than
creating them.

```ts
import { win, chrome } from "@/core/facade";

const main = win.getWindow();               // the main window (undefined before boot)
main?.setTitle(`${n} unsaved`);
await win.openWindow("settings");           // reopen-by-name; reuses an open window
await win.openWindow({ title: "Preview", width: 900, height: 640, route: "/preview" });
win.getWindowCount();
```

- `DesktopWindow` **is** Electron's `BrowserWindow` — call Electron methods on it.
- `openWindow` is **async**; always `await` it. It reuses an open window keyed by
  preset name (or inline `title`).
- `win.getWindow()` / `win.getWindowCount()` are read-only and safe anywhere;
  creating a window needs the real Electron runtime — guard it in tests/CLI.
- App menu, context menu and tray apply to the **main window only**.
- To change the app menu, right-click menu or tray, edit
  `src/window/app-menu.ts` (`defaultMenuItems` / `toElectronMenu` /
  `installAppMenu`), `src/window/context-menu.ts` (`installContextMenu`) and
  `src/window/tray.ts` (`createTray` / `createAppTray`) directly — these are
  app-shipped, not framework. A menu item's `id` reaches the renderer via
  `webContents.send("menu-click", id)`.

`chrome` (menus, tray, dialogs) is **backend-only** — the renderer can never
import it. Bridge it through a controller if the UI needs it.

```ts
if (await chrome.confirmDialog(`Delete "${name}"?`)) await files.removePath(path);
await chrome.alertDialog("Done");
```

`pickers` and the top-level `alertDialog` / `confirmDialog` are also on the facade;
`confirmDialog`/`alertDialog` are **async** — await them.

## 10. Frontend: pages, components & the `@/ui` alias

The renderer lives in `src/ui/src`. Two aliases, and they are **not**
interchangeable:

- `@/ui/*` → `src/ui/src/*` (frontend code: pages, components, stores, plugins)
- `@/*` → `src/*` (the backend tree)

So a page imports `@/ui/plugins/gum.ts`, never `@/plugins/gum.ts`. Vite
(`src/ui/vite.config.ts`), the UI tsconfig, and `vitest.config.ts` all define
these aliases; use them everywhere.

- **Pages** go in `src/ui/src/pages/<name>/index.vue` and are registered in
  `src/ui/src/router/index.ts` (lazy `component: () => import("@/ui/pages/...")`).
- **Shared components** go in `src/ui/src/components/`. The starter ships
  `components/datatable/` (DataTable + `Pagination.vue`, `SelectOpption.vue`,
  `DataTableSkeleton.vue` and the small `Button`/`Input`/`Checkbox` controls).
- **Stores** are Pinia: `src/ui/src/stores/<name>.ts`, `defineStore(...)`. Pinia is
  installed in `src/ui/src/app.ts` (`createPinia()`), so `useStore()` works in any
  component setup.
- `App.vue` is just `<router-view />`. Bootstrap CSS + Bootstrap Icons + the SCSS
  are imported once in `src/ui/src/app.ts`, which also installs `@unhead/vue`
  (`createHead()`) — call `useHead({ title })` from a page to set the window title.
- Global type shims live in `src/ui/src/{bindings.d.ts,env.d.ts,global.d.ts}` —
  keep `global.d.ts` a global **script** (no top-level `import`/`export`), or its
  `declare module` shims become augmentations and break.

Rule: the renderer **never** imports `@/core/**`, `@/modules/**`, `electron`, or
`node:*`. If you need backend data, add a controller + binding and call it.

## 11. Frontend data: gum & DataTable

`gum` (`src/ui/src/plugins/gum.ts`) is the request/form helper. It has two
interchangeable transports — `"bindings"` (in-process, no HTTP; auto-detected
when the Electron bridge is present) and `"http"`. Over bindings the "URL" **is**
the binding name:

```ts
import { useGum, useGumRemember } from "@/ui/plugins/gum.ts";

const gum = useGum();

// fetch, no navigation (what DataTable does)
const res = await gum.get("app.demo.table", { navigate: false, query: { page: 2, size: 15 } });
res.data.total;

// submit a form over bindings — pass defaults to useGum to also get `form`
const { form } = useGum({ name: "", email: "" });
await form.post("users.users.store");
form.errors;               // { field: "first message" }
form.processing;           // boolean
```

- `useGum` exposes `get/post/put/patch/delete/reload/visit`; `processing` is a ref.
- Payload contract matches the generated handlers: `index()` → `undefined`,
  `show(params)`/`destroy(params)` → query/data, `store(body)` → data,
  `update({ params, body })` → both. `gum.patch("users.users.update", body, { query: { id } })`.
- `useGum(defaults).form` returns reactive `data`, `errors`, `processing`,
  `wasSuccessful`, `recentlySuccessful`, `isDirty` plus `setError` / `clearErrors`
  / `reset` and `post`/`put`/`patch`/`delete` (plus the `*With` fetcher variants).
  `useGumForm` is **deprecated** — use `useGum(defaults).form`.
- `useGumRemember(key, defaults)` is a localStorage ref scoped to the current route.
- Errors are normalized: Zod `flatten` from `validate.run` becomes per-field
  errors (form-level errors under `$root`). Thrown handler errors survive Electron
  IPC — `bindAll` returns a tagged envelope and the preload bridge rethrows it with
  `.response.data` — so `form.errors` populates over bindings too. This is why
  backend handlers must validate with `validate.run`.
- `useGum()` reads the router (`useRouter`/`useRoute`), so call it in a component
  setup, never at module scope. In a Pinia store call the binding directly
  (`bindings["users.users.store"](payload)`) or pass a `fetcher` to `gum.postWith`
  / `useGum(...).form.postWith`.

**DataTable** (`src/ui/src/components/datatable/index.vue`) is the gum-powered
table. Point `path` at a binding (or REST endpoint) that returns the `paginate`
envelope and drive it with slots:

```vue
<DataTable ref="table" path="blog.post.index" :option="[10, 25, 50]" @remove="removeRows">
  <template #thead><th>Name</th><th>Email</th></template>
  <template #tbody="{ td }"><td>{{ td.name }}</td><td>{{ td.email }}</td></template>
</DataTable>
```

```ts
const table = ref<InstanceType<typeof DataTable> | null>(null);
async function removeRows(ids: Array<string | number>) {
  await gum.delete("blog.post.destroy", { query: { ids } });
  await table.value?.load(1);   // exposed: load(page?), state, loading
}
```

Props: `path` (required), `search`, `loop`, `option`, `removable`, `countable`,
`searchable`, `optionable`, `disabled`, `transport`, `baseURL`. Slots: `#thead`,
`#tbody="{ td }"`, `#customhead`, `#custombody`, `#extra`, `#extra-tools`. Each
row needs `td.id` for selection. The table sends `?page=&size=&search=` and
expects `{ data, current_page, last_page, per_page, total, from, to, path }`.

Realtime (`pulse`, Socket.IO) is in `src/ui/src/plugins/pulse.ts`; it only
activates when `VITE_SOCKET_URL` / `VITE_API_URL` is set. `pulse` is a plain
singleton (not a composable), so import it anywhere — including a Pinia store.
Nothing is offline-aware: `bindings` are in-process (work offline by nature), but
HTTP and pulse need the network — guard them with `navigator.onLine`.

## 12. Config: app identity & windows

- `src/config/app.ts` — the app's identity: `name` (kebab), `productName`,
  `description`, `appId`, `protocol`, `uninstallDataFolders`. After editing, run
  `npm run config:sync` (also part of `prepare`/`dev`/`build`) to update
  `package.json` and the NSIS installer fields. Runtime config reads from here.
- `src/config/winsetup.ts` — `windows` (each entry becomes a `BrowserWindow` at
  boot; the first is the main window), `windowDev.devTools`, and `ChromeParts`
  (`appMenu`/`contextMenu`/`tray`). Add presets here and open them with
  `win.openWindow("<name>")`.

`DESKAPP_UI=false` runs the app headless (tray only); the flag is read via
`config.ui.enabled`. Do not hardcode app names or window sizes in components —
read them from config.

## 13. Commands

```sh
npm run dev                 # config:sync + db:schema + bindings:gen, then Vite + esbuild watch + Electron
npm run build               # UI (vite) + main/preload (esbuild)
npm run package             # build + electron-builder installer
npm start                   # run the built app (out/main/index.cjs)
npm run maker               # list all maker commands
npm run maker -- <command>  # run one (make:*, db:*, bindings:gen, codegen, config:sync, ...)
npm test                    # Vitest (node env; src/ui/** excluded)
npm run lint                # Biome
```

`codegen` = schema + bindings. `config:sync` = app identity → package.json/NSIS.

## 14. Testing

- Tests are Vitest, `globals: true`, node environment, in
  `src/modules/**/__tests__/*.test.ts` (also `src/**/*.test.ts`).
- `src/ui/**` is **excluded** from Vitest — do not write renderer tests here; test
  the backend handler instead.
- Mock the facade when a handler touches framework services, e.g.:

  ```ts
  // ./src/modules/app/__tests__/demo.controller.test.ts

  import { describe, expect, it, vi } from "vitest";
  vi.mock("@/core/facade", () => ({ queue: { create: () => ({ add: (t: () => Promise<unknown>) => t() }) } }));
  import { handlers, queue } from "@/modules/app/controllers/demo.controller";
  ```

- `make:test <module> [name]` scaffolds a file; keep the test next to the module
  it covers.

## 15. Before you say "done"

1. **Regenerate what you changed.**
   - Added/removed/renamed a controller → `npm run maker -- bindings:gen`.
   - Added/changed a model → `npm run maker -- db:generate` (or `db:migrate`).
   - Changed app identity → `npm run config:sync`.
2. **Verify, don't assume:** run `npm test` and `npm run lint`; for anything that
   touches boot, windows, IPC or the DB, run `npm run dev` and exercise it.
3. **Check the rules:** no edits under `src/core/**`; no hand-edited generated
   files; every new file opens with its location header; every new handler is in
   its controller's `handlers` map; cross-module imports go through a module
   `facade.ts`; the renderer imports no backend code; imports use `@/core/facade`
   and the `@/ui/*` alias.
