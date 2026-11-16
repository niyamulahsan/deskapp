# Conventions

How files are named, where they live, and how the layers talk to each other.
These are the same rules the project's `AGENTS.md` states — this page is the
reference.

## The one principle

> **Directory = meaning. Suffix = discovery.**

The framework discovers your code by **folder and suffix**, never by a manifest
you maintain by hand. A controller only exists if it sits in a module's
`controllers/` folder and ends in `.controller.ts`. `bindings:gen` walks exactly
that path:

```ts
// src/core/api/generate.manifest.ts
const controllersDir = path.join(MODULES_DIR, moduleName, "controllers");
for (const file of fs.readdirSync(controllersDir, { withFileTypes: true })) {
  if (!file.isFile() || !file.name.endsWith(".controller.ts")) continue;
  // -> bound as <module>.<controller>.<handler>
}
```

So the folder makes a file a controller, and the `.controller.ts` suffix is how
the controller name is read back out. A file anywhere else is invisible.

## Directory table

All paths are relative to `src/modules/<module>/`.

| Kind       | Directory           | Suffix           | Example               |
| ---------- | ------------------- | ---------------- | --------------------- |
| controller | `controllers/`      | `*.controller.ts`| `post.controller.ts`  |
| schema     | `controllers/`      | `*.schema.ts`    | `post.schema.ts`      |
| model      | `database/models/`  | `*.model.ts`     | `post.model.ts`       |
| seeder     | `database/seeders/` | `*.seed.ts`      | `post.seed.ts`        |
| test       | `__tests__/`        | `*.test.ts`      | `post.test.ts`        |

A scaffolded module looks like this:

```
src/modules/blog/
├── controllers/
│   ├── post.controller.ts
│   └── post.schema.ts
├── database/
│   ├── models/
│   │   └── post.model.ts
│   └── seeders/
│       └── post.seed.ts
└── __tests__/
    └── post.test.ts
```

There are no `routes/`, `services/`, `helpers/`, `schemas/` or `facade.ts` in a
deskapp module. A controller **is** the entry point (the UI calls it over
bindings), schemas sit beside their controller, and the database layer is the
model + seeder pair. Adding folders the framework does not scan just creates code
nothing can reach.

## No location headers

Unlike some frameworks, deskapp source files **do not** open with a
`// ./path/to/file.ts` comment. Do not add one; `maker` does not write one, and
the docs never show one. A file's path is its path.

## Imports and the `@/` alias

Everything is imported through an alias — never a `../` chain across folders.

| Alias      | Resolves to        | Used for                                    |
| ---------- | ------------------ | ------------------------------------------- |
| `@/*`      | `src/*`            | backend code, modules, models               |
| `@config/*`| `src/config/*`     | `app.ts`, `winsetup.ts`                      |
| `@/ui/*`   | `src/ui/src/*`     | the renderer: pages, components, stores, plugins |
| `@/core/facade` | `src/core/facade.ts` | every framework utility                |

```ts
import { db, paginate, validate } from "@/core/facade";
import { posts } from "@/modules/blog/database/models/post.model";
import { appConfig } from "@config/app";
```

The two roots are easy to confuse: in the **UI**, `@/ui/plugins/gum.ts` is
`src/ui/src/plugins/gum.ts`, while `@/` there is still the backend `src/`. A page
imports `@/ui/components/...`; it never imports `@/modules/...` (see
[the boundary](#the-renderer--backend-boundary)).

`@/core/facade` is the **only** framework surface app code imports. Do not reach
into `@/core/database/connection`, `@/core/utils/queue`, and so on from a module
— import the facade.

## Controllers export a `handlers` map

A controller file exports named functions **and** a `handlers` object. The
registry reflects exactly that map; a handler missing from it is never
registered:

```ts
export const index = async () => { /* ... */ };
export const store = async (body: unknown) => { /* ... */ };

export const handlers = { index, store };
```

Handler names become the last segment of the binding:
`blog.post.index`, `blog.post.store`. Prefer the conventional set
`index` / `show` / `store` / `update` / `destroy` so `gum` and `DataTable` can
bind to them with no ceremony (see [Gum](/guide/gum)).

## Schemas are the source of truth for input

A request shape is declared once, in the controller's sibling
`<name>.schema.ts`, and validated with the facade runner:

```ts
// src/modules/blog/controllers/post.schema.ts
import { z } from "zod";

export const CreatePostSchema = z.object({ name: z.string().min(1) });
export const PostIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
```

```ts
// src/modules/blog/controllers/post.controller.ts
import { validate } from "@/core/facade";
import { CreatePostSchema, PostIdParamsSchema } from "@/modules/blog/controllers/post.schema";

export const show = async (params: unknown) => {
  const { id } = await validate.run(PostIdParamsSchema, params);
  // ...
};
```

- The schema is the **value** that validates at runtime; derive a **type** from
  it on the next line when you need one (`type CreatePostType = z.input<typeof CreatePostSchema>`).
- Always validate IPC input with `validate.run`. It throws the normalized
  `{ status: 422, message, errors }` shape that `gum` renders into per-field form
  errors — calling `schema.parse` directly loses that.
- Never trust `unknown` from the renderer. Ids, bodies and queries are all
  user-controlled.

## Generated files are never edited

Three paths are produced by the maker and overwritten without warning:

| File                                | Regenerate with                       |
| ----------------------------------- | ------------------------------------- |
| `src/core/api/bindings.generated.ts`| `npm run maker -- bindings:gen`        |
| `src/database/schema.ts`            | `npm run maker -- db:schema`           |
| `src/database/migrations/**`        | `npm run maker -- db:generate`         |

After adding or removing a controller, run `bindings:gen` (or `codegen` for
schema + bindings) — a packaged build reads the generated list, so an
un-regenerated binding does not exist at runtime.

## No per-module facades

deskapp has no `facade.ts` per module. Cross-module access is direct and
shallow:

- Need another module's **table**? Import the model file directly.
- Genuinely reusing another module's **schema or helper**? Import that file.

Keep the graph acyclic and the coupling obvious. The one framework-level facade
is `@/core/facade` — that is the rule that matters.

## The renderer / backend boundary

The Electron **main process** is the backend; the Vue renderer is a separate
world that reaches it only through bindings.

| Direction            | Allowed                                                        |
| -------------------- | -------------------------------------------------------------- |
| `src/modules/**` →   | `@/core/facade`, `@config/*`, `@/modules/**`, `electron`, `node:*`, `drizzle-orm` |
| `src/ui/**` →        | Vue, `@/ui/**`, `@/plugins/*`, `bindings` / `md` — **nothing from `@/core`, `@/modules`, `electron` or `node:*`** |

If the UI needs data, add a controller handler and call it as
`bindings["<module>.<controller>.<handler>"]()` or `md.<module>.<controller>.<handler>()`.

## Naming

- **Module** folder: lowercase, one word where possible (`blog`, `auth`).
- **Controller / model / seeder** name: lowercase; `make:*` lower-cases what you
  pass, and a model named `post` produces the table variable `posts` and the SQL
  table `posts`.
- **Bindings**: `<module>.<controller>.<handler>`, all lowercase.
- **Files**: keep the suffix that matches the folder (`*.controller.ts`,
  `*.schema.ts`, `*.model.ts`, `*.seed.ts`, `*.test.ts`).

## Related

- [Modules](/guide/modules) — creating modules and components
- [Controllers & Bindings](/guide/controllers) — the handler contract
- [Architecture](/guide/architecture) — full project layout
- [Unit Testing](/guide/testing) — where tests live and how to run them
