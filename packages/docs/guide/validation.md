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

Controllers use it as a one-liner before touching the database:

```ts
import { db, validate } from "@/core/facade.ts";
import { posts } from "@/modules/blog/database/models/post.model.ts";

const CreatePostSchema = validate.z.object({
  title: validate.z.string().min(1).max(200),
  body: validate.z.string().min(1),
});

const create = async (input: unknown) => {
  const data = await validate.run(CreatePostSchema, input); // throws the 422 envelope on bad input
  const [row] = await db.insert(posts).values(data).returning();
  return { ok: true, post: row };
};
```

The `make:controller` command scaffolds a controller + a matching Zod schema stub ready to customise.