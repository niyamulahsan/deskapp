# Passwords

bcrypt password hashing, via the facade:

```ts
import { pass } from "@/core/facade.ts";

const hash = await pass.hashPassword("correct horse battery staple");

const ok = await pass.verifyPassword("correct horse battery staple", hash); // true
const bad = await pass.verifyPassword("wrong", hash);                       // false
```

- Uses [bcryptjs](https://www.npmjs.com/package/bcryptjs) (`npm:bcryptjs`) from the root import map — pure JS, no native dependency.
- Store the returned hash (not the plain password) in the database — give your model a `password` text column for it.
- `pass.verifyPassword` costs are handled inside the library; it's safe for normal login flows.

Example usage in a controller:

```ts
import { db, pass } from "@/core/facade.ts";
import { users } from "@/modules/auth/database/models/user.model.ts";

const [row] = await db.insert(users).values({
  name: data.name,
  email: data.email,
  password: await pass.hashPassword(data.password),
}).returning();
return { ok: true, user: { id: row.id, name: row.name, email: row.email } };
```