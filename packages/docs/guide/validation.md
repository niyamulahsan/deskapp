# Validation

Input validation uses **Zod** with a normalised error envelope, via the facade:

```ts
import { validate } from "@/core/facade.ts";

const schema = validate.z.object({
  email: validate.z.string().email(),
  age: validate.z.number().int().min(0),
});
```

Build schemas with `validate.z` (re-exports zod), then run them with `validate.run`:

```ts
const data = await validate.run(schema, input);
```

`validate.run(schema, input)`:

- On success: returns the parsed (typed) value.
- On failure: **throws** a controlled object shaped for frontend display:

```ts
{
  status: 422,
  message: "Validation failed",
  errors: {
    formErrors: [],
    fieldErrors: { email: ["Invalid email"], age: ["Number must be greater than or equal to 0"] },
  },
}
```

(`errors` is zod's `result.error.flatten()` — `formErrors` + `fieldErrors`.)

A request shape lives in the controller's sibling `<name>.schema.ts`, and each
schema is paired with its inferred type on the next line:

```ts
// ./src/modules/blog/controllers/post.schema.ts

import { z } from "zod";

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});
export type CreatePostType = z.input<typeof CreatePostSchema>;
```

- `z.input` is the caller's shape (a `.default()` field stays optional);
  `z.infer` is the parsed/response shape. Name the pair `<X>Schema` / `<X>Type`.
- Import the `*Type` where a shape is needed instead of re-declaring it by hand.

Controllers use it as a one-liner before touching the database:

```ts
// ./src/modules/blog/controllers/post.controller.ts

import { db, validate } from "@/core/facade.ts";
import { posts } from "@/modules/blog/database/models/post.model.ts";
import { CreatePostSchema } from "@/modules/blog/controllers/post.schema";

const create = async (input: unknown) => {
  const data = await validate.run(CreatePostSchema, input); // throws the 422 envelope on bad input
  const [row] = await db.insert(posts).values(data).returning();
  return { ok: true, post: row };
};
```

The `make:controller` command scaffolds a controller + a matching Zod schema stub ready to customise.