# `pass` — password hashing

Imported from the facade: `import { pass } from "@/core/facade.ts"`.

bcrypt password hashing and verification (10 salt rounds). See [Password](../guide/password).

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `hashPassword` | `(password: string) => Promise<string>` | Hash a plaintext password; returns the bcrypt hash string. |
| `verifyPassword` | `(password: string, hash: string) => Promise<boolean>` | Check a plaintext password against a stored hash. |

## Use cases

### Sign up / create a user

Hash before storing — never keep plaintext.

```ts
import { db, pass } from "@/core/facade.ts";
import { users } from "@/modules/auth/database/models/user.model.ts";

await db.insert(users).values({
  name: input.name,
  email: input.email,
  password: await pass.hashPassword(input.password),
});
```

Seeders in `src/modules/<module>/database/seeders/` follow this exact insert pattern.

### Login / authenticate

Look up by email, then verify against the stored hash.

```ts
const user = await db.query.users.findFirst({
  where: (t, { eq }) => eq(t.email, input.email),
});
const ok = await pass.verifyPassword(input.password, user?.password ?? "");
if (ok) return { ok: true, user };
throw { status: 401, message: "Invalid credentials" };
```

### Change / reset a password

Re-hash the new value and update the row.

```ts
import { db, sql } from "@/core/facade.ts";
import { users } from "@/modules/auth/database/models/user.model.ts";

await db.update(users)
  .set({ password: await pass.hashPassword(input.newPassword) })
  .where(sql`id = ${userId}`);
```

### Seed demo users with a known password

Seeders hash once at seed time so logins work with a documented password.

```ts
import { db } from "@/core/facade.ts";
import { users } from "@/modules/auth/database/models/user.model.ts";

export default async () => {
  await db.insert(users).values({
    name: "Demo User",
    email: "demo@example.com",
    password: await pass.hashPassword("password"),
  });
};
```

## Notes

- Always hash before storing; never store plaintext.
- `verifyPassword` is constant-time (bcrypt.compare) — safe against timing attacks.

## Related

- [validate](./validate) · [db](./db)