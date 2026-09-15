# gum — Requests & Forms

`gum.ts` is the frontend's **Inertia-style request/form helper** for a Vue 3 app. It lives in `src/ui/src/plugins/gum.ts` and ships with the **DataTable** component (`src/ui/src/components/datatable/`), so listing, searching, paginating and deleting records is a few lines — no manual HTTP plumbing.

It exists to answer one question: **"how do I talk to the backend from the UI?"** and gives you two interchangeable answers — see [Transports](#transports).

## Transports

| Transport | When | The "url" is… | Under the hood |
| --- | --- | --- | --- |
| `"bindings"` **(default)** | Desktop app, backend runs in-process | a binding name `<module>.<controller>.<handler>`, e.g. `app.demo.table` | `bindings[name](...args)` → no HTTP, no CORS, no server |
| `"http"` | Web build / remote API, backend is a separate process | a REST endpoint, e.g. `/api/users` | `axios` calls |

The transport is chosen **per app** in `GumPlugin` options, and can be overridden **per call or per table** — so one UI can mix SQLite bindings and a remote API:

```ts
app.use(GumPlugin, { transport: "bindings" });            // global default
gum.get('app.demo.table', { navigate: false });            // bindings (inherited)
gum.get('/api/users', { transport: "http", baseURL: "https://api.example.com" });
```

Regardless of transport every call returns the same envelope: **`{ data }`** — the raw response body. Both transports speak the same payload conventions, so you can switch one for the other without touching your components.

## Setup

`gum` is installed like any Vue plugin. `src/ui/src/app.ts` already does this:

```ts
import { GumPlugin } from "@/ui/plugins/gum.ts";

createApp(App)
  .use(PulsePlugin)
  .use(GumPlugin, options)   // options optional
  .use(router)
  .mount('#app');
```

### Plugin options

| Option | Default | Meaning |
| --- | --- | --- |
| `rememberPrefix` | `"gum"` | localStorage key prefix for `useGumRemember` |
| `recentlySuccessfulDuration` | `2000` | how long `useGumForm`'s `recentlySuccessful` stays `true` (ms) |
| `transport` | `"bindings"` | default transport: `"bindings"` or `"http"` |
| `baseURL` | `""` | base URL prepended to every HTTP request |

`gum` requires **Vue Router to be installed** (`useRouter`/`useRoute`). It also needs the `bindings` global, which only exists under `deno desktop` — the demo table in the starter dashboard runs through `deno task dev`.

## Payload conventions

Handlers and HTTP endpoints follow the same contract as the generated controllers / REST routes. Bindings map directly:

| Controller handler | Method | Payload passed to the handler |
| --- | --- | --- |
| `index()` | `get` | `undefined` |
| `show(params)` | `get` | `query` (or `data`) |
| `store(body)` | `post` | `data` |
| `update({ params, body })` | `put` / `patch` | `{ params: query ?? {}, body: data ?? {} }` |
| `destroy(params)` | `delete` | `query` (or `data`) |

Over HTTP the same shape becomes axios conventions: `params` → query string, `data` → request body, and `update` sends both.

> **Under the `bindings` transport there is no HTTP** — the URL is the binding name (`bindings['<module>.<controller>.<handler>']`) and the method is advisory: it only decides which option slot the handler receives (`query` vs `data`). `gum.post('collection.collection.destroyAll', { ids })` and `gum.delete('collection.collection.destroyAll', { query: { ids } })` call the **same** handler with the **same** object. Prefer `delete`/`post` matching the REST-ish shape of the handler (`destroy`-style handlers conventionally take `query: { ids }`), but any method works for a handler that takes a plain object.

## `useGum()` — one request, two worlds

```ts
import { useGum } from "@/ui/plugins/gum.ts";

const gum = useGum();
```

### Visit methods

| Method | Signature |
| --- | --- |
| `get(url, options?)` | fetch data (GET) |
| `post(url, data?, options?)` | create (POST) |
| `put(url, data?, options?)` | full update (PUT) |
| `patch(url, data?, options?)` | partial update (PATCH) |
| `delete(url, options?)` | delete (DELETE) |
| `reload(options?)` | GET the current route again |
| `visit(url, options)` | the core; everything above delegates to it |

`processing` (a `ref`) flips `true` while a visit is in flight.

### Visit options

`method`, `data`, `query`, `transport`, `baseURL` are the request controls above. The rest shape the navigation + lifecycle:

| Option | Default | Meaning |
| --- | --- | --- |
| `routePath` | current route path | path to navigate to when `navigate` runs |
| `replace` | `false` | `router.replace` instead of `router.push` |
| `preserveState` | `method !== "get"` | keep `useGumRemember` values for that path |
| `preserveScroll` | `false` | restore the previous scroll position afterwards |
| `skipFetch` | `false` | skip the request, only do navigation lifecycle |
| `navigate` | `method === "get"` | after a **GET**, push `query` into the route (SPA filter state). Set `false` for plain data fetch |
| `onBefore` | — | return `false` to cancel the visit |
| `onStart` | — | just before the request |
| `onSuccess(response)` | — | after success; `response.data` is the body |
| `onError(errors, error)` | — | after a failure; `errors` is normalized (see below) |
| `onFinish` | — | always, last |

**Two idioms, deliberately different:**

**Fetch in-process (what the DataTable does)** — GET, no navigation:

```ts
const res = await gum.get("app.demo.table", {
  navigate: false,
  query: { page: 2, size: 15, search: "ava" },
});
console.log(res.data.total);       // backend envelope -> { data, total, ... }
```

**SPA-style navigation** — GET pushes its `query` into the URL (like Inertia), and when `preserveState: false` it clears the remembered state for that path:

```ts
await gum.get("inventory.inventory.index", {
  query: { page: 2 },
  // defaults: replace=false, preserveState=false -> remember keys for this
  // path are cleared and the query lands in the URL
});
```

**Form submission over bindings:**

```ts
const res = await gum.post("auth.auth.register", { email, password });
// = bindings['auth.auth.register']({ email, password })
```

**Rows to an update handler** — `update({ params, body })`:

```ts
await gum.patch("users.users.update", { name: "Ava" }, { query: { id: 10 } });
```

### Error normalization

A failed visit throws (or calls `onError`) a `GumRequestError`. gum normalizes it into a per-field map so you can render errors next to inputs:

```ts
type NormalizedErrors = Record<string, string[] | string>;
// { email: ["email is not valid"], $root: "...form-level message..." }
```

Handled shapes (all from the same backend family):

- Zod `flatten` output from `validate.run` — `{ errors: { fieldErrors: { field: [...] }, formErrors: [...] } }` → per-field arrays, form errors under `$root`.
- A flat `{ errors: { field: "message" } }` map.
- A bare `{ message: "..." }` → `$root`.
- HTTP 422 responses re-thrown identically (axios failures are normalized in `invokeHttp`).

## `useGumForm()` — forms with state

```ts
import { useGumForm } from "@/ui/plugins/gum.ts";

const form = useGumForm({
  name: "",
  email: "",
  role: "viewer",
});

await form.post("users.users.store");   // send `data` as the store body
```

State returned:

| Property | Meaning |
| --- | --- |
| `data` | reactive form values (a structured clone of your defaults) |
| `errors` | `Partial<Record<key, string>>` — first error per field |
| `processing` | submitting in progress |
| `progress` | reserved (upload) — currently `null` |
| `wasSuccessful` | last submit succeeded |
| `recentlySuccessful` | true for `recentlySuccessfulDuration` ms after success |
| `isDirty` | data changed since init (deep JSON compare) |

Helpers: `setError(field, msg)`, `clearErrors(...fields)`, `reset(...fields)` (restores the original defaults), and submit methods `post` / `put` / `patch` / `delete(url, payload?, options?)`, each taking `onStart` / `onSuccess` / `onError(errors, error)` / `onFinish` hooks.

A full create flow with a real controller:

```ts
// ui/pages/Users/Create.vue
const form = useGumForm({ name: "", email: "", role: "viewer" });

const submit = () => form.post('users.users.store', undefined, {
  onSuccess: () => { router.push({ path: "/users" }); },
  onError: (errors) => console.log(errors),   // also lands in form.errors
});
```

```ts
// modules/users/controllers/users.controller.ts
import { validate } from "@/core/facade.ts";
import { z } from "zod";

export const store = async (body?: { name?: string; email?: string; role?: string; }) => {
  return validate.run(
    z.object({ name: z.string().min(2), email: z.string().email(), role: z.string() }),
    body ?? {},
  ); // throws the zod flatten error gum renders; see guide/validation.md
};
```

> **Note:** `useGumForm.submit` uses the **plugin-wide** transport. To use forms against a REST API, register with `app.use(GumPlugin, { transport: "http", baseURL: "/api" })` — then every `form.post`/`put`/… hits the HTTP endpoint. Validation failures arriving as 422 with `{ errors: {...} }` populate `form.errors` exactly like bindings.

## `useGumRemember()` — page state that survives reloads

A localStorage-backed ref scoped to the current route (prefix — `rememberPrefix`). Remembers filters, tabs, drafts across navigations and reloads:

```ts
import { useGumRemember } from "@/ui/plugins/gum.ts";

const filters = useGumRemember("inventory-filters", { q: "", status: "all" });
filters.value.status;  // persisted under `gum:inventory-filters`
```

When a GET visit runs with `preserveState: false` (the default), gum clears all remembered keys registered for the navigated path (`clearRememberForPath`).

## `DataTable` — the gum component

The starter ships a ready-made, gum-powered table at `src/ui/src/components/datatable/index.vue` (with `Pagination.vue`, `SelectOpption.vue`, `DataTableSkeleton.vue`, and the small `Button`/`Input`/`Checkbox` controls it needs). It talks to **any** backend that returns the paginate envelope and drives the whole flow — search (debounced 500ms), size, pagination, row selection, delete — through gum. The scaffold dashboard already demonstrates it against `app.demo.table`.

### Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `path` (required) | — | binding name **or** REST endpoint |
| `search` | `""` | external search term |
| `loop` | `false` | static rows instead of fetching (e.g. a computed list) |
| `option` | `[10, 25, 50]` | page-size choices |
| `removable` | `true` | show the selection checkbox + trash button |
| `countable` | `true` | show the `#` index column |
| `searchable` | `true` | show the search box |
| `optionable` | `true` | show the "Show N entries" select |
| `disabled` | `false` | disable selection while loading |
| `transport` | plugin default | per-table `"bindings"` or `"http"` |
| `baseURL` | plugin default | HTTP base URL for `path` |

### Slots & events

- `#thead` — column header cells.
- `#tbody="{ td }"` — one row; `td` is the record (needs `td.id` for selection).
- `#customhead`, `#custombody`, `#extra`, `#extra-tools` — escape hatches.
- `@remove="handlers(ids)"` — emitted with the selected ids when the trash icon is clicked.
- Exposed on the ref: `load(page?)` (reload, `page` optional), `state`, `loading`.

### Envelope contract

On load the table sends `?page=&size=&search=` and expects the same envelope the backend pagination helpers produce (`src/core/database/paginate.ts`):

```ts
{
  data: T[],
  current_page: number,
  last_page: number,
  per_page: number,
  total: number,
  from: number | null,
  to: number | null,
  path: string,
}
```

### Usage — SQLite bindings (desktop, in-process)

The simplest case. The handler is just another controller export — the DataTable's `<module>.<controller>.<handler>` binding:

**UI** — `pages/users/index.vue`:

```vue
<template>
    <DataTable
      ref="table"
      path="app.demo.table"
      :option="[10, 25, 50]"
      @remove="removeRows">
      <template #thead>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Created</th>
      </template>
      <template #tbody="{ td }">
        <td>{{ td.name }}</td>
        <td>{{ td.email }}</td>
        <td>{{ td.role }}</td>
        <td>{{ td.created }}</td>
      </template>
    </DataTable>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGum } from '@/ui/plugins/gum.ts';
import DataTable from '@/ui/components/datatable/index.vue';

const gum = useGum();
const table = ref<InstanceType<typeof DataTable> | null>(null);

async function removeRows(ids: Array<string | number>) {
  await gum.delete('app.demo.destroy', { query: { ids } });
  await table.value?.load(1);
}
</script>
```

**Backend** — `modules/app/controllers/demo.controller.ts` (the exact scaffold handler — in-memory rows, so it needs no migration). A production module uses a real model instead:

```ts
import * as schema from "@/database/schema.ts";
import { db, paginate } from "@/core/facade.ts";

export const table = async (opts?: { page?: number; size?: number }) => {
  // Real SQLite path: a Drizzle model served page-by-page. (The starter's
  // `app.demo.table` does the same over generated in-memory rows instead.)
  const env = await paginate.model({
    page: opts?.page,
    perPage: opts?.size,
    path: "users.users.index",
    table: schema.users,
    query: db.query.users,
  });
  return env; // { data, current_page, last_page, per_page, total, from, to, path }
};

export const destroy = async (opts?: { ids?: Array<string | number> }) => {
  // delete rows by id...
  return { ok: true, removed: (opts?.ids ?? []).length };
};

export const handlers = { table, destroy };
```

Run it: `deno task dev`, open the dashboard, tick rows, trash them. The console prints the `app.demo.destroy` response.

### Usage — HTTP / REST (or mixing both)

The same component reads any API returning the identical envelope, either app-wide:

```ts
app.use(GumPlugin, { transport: "http", baseURL: "https://api.example.com" });
```

or per table:

```vue
<DataTable
  path="/users"
  :transport="'http'"
  baseURL="https://api.example.com"
  :option="[10, 25, 50]">
  ...
</DataTable>
```

The backend can be anything — Express, Fastify, a Deno `serve` — as long as it honors `?page=&size=&search=` and replies with the envelope above, plus `422 { errors: { fieldErrors, formErrors } }` for validation failures if the rows are editable.

### Loading skeleton

While a page loads, render the shipped skeleton with matching columns/rows:

```vue
<DataTableSkeleton :col="5" :row="8" />
```