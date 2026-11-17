# `validate` — validation

Imported from the facade: `import { validate } from "@/core/facade.ts"`.

Schema validation with a normalized error shape: build a schema with `validate.z` (Zod), run data through it with `validate.run`. See [Validation](../guide/validation).

## Signature

| Member | Signature                                              | Description                                                                                             |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `z`    | (Zod)                                                  | The full Zod namespace — build schemas.                                                                 |
| `run`  | `<T>(schema: ZodType<T>, data: unknown) => Promise<T>` | Validate + parse. On success returns typed data; on failure **throws** a structured 422-shaped failure. |

## Error shape

`validate.run` throws on invalid input:

```ts
{
  status: 422,
  message: "Validation failed",
  errors: /* zod issue .flatten() */ { formErrors: [], fieldErrors: { email: ["Invalid email"] } },
}
```

## Use cases

### Guard a controller create endpoint

Run first, use the parsed output — the throw aborts with a 422 shape the frontend can display.

```ts
import { db, validate } from "@/core/facade.ts";
import { posts } from "@/modules/blog/database/models/post.model.ts";

const postSchema = validate.z.object({
  title: validate.z.string().min(1).max(200),
  body: validate.z.string().min(1),
});

export const create = async (input: unknown) => {
  const data = await validate.run(postSchema, input); // throws 422-shaped on bad input
  const [row] = await db.insert(posts).values(data).returning();
  return { ok: true, post: row };
};
```

### Login form schema

Compose email + password rules in one object.

```ts
const loginSchema = validate.z.object({
  email: validate.z.string().email(),
  password: validate.z.string().min(8),
});

await validate.run(loginSchema, input);
```

### Sanitize/transform data before touching the disk

Trust only the typed output — not whatever the caller passed raw.

```ts
const profileSchema = validate.z.object({
  nickname: validate.z.string().trim().min(2).max(30),
  bio: validate.z.string().max(500).default(""),
  tags: validate.z.array(validate.z.string()).max(10),
});

const data = await validate.run(profileSchema, raw); // trims, defaults applied
await storage.put("profile.json", JSON.stringify(data));
```

### Reuse one schema across many controllers

Declare the schema once in the controller's sibling `<name>.schema.ts`, with its
inferred type, and import it everywhere.

```ts
// ./src/modules/blog/controllers/post.schema.ts

import { z } from "zod";

export const PostSchema = z.object({ /* ... */ });
export type PostType = z.input<typeof PostSchema>;
```

```ts
// ./src/modules/blog/controllers/post.controller.ts

import { validate } from "@/core/facade";
import { PostSchema } from "@/modules/blog/controllers/post.schema";

const data = await validate.run(PostSchema, input);
```

## Notes

- `validate.run` uses `safeParseAsync`, so it never throws raw Zod issues — always the 422 envelope, easy to return to the frontend.
- The `make:controller` generator scaffolds a controller with a `validate.z` stub ready to customise.

## Related

- [pass](./pass) · [db](./db)