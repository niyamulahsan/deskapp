# Database

Deskapp ships SQLite via [Drizzle ORM](https://orm.drizzle.team), with schema generation, migrations, seeding, and [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination.

## Connection

`db.init()` opens the database (called at boot in `src/main.ts`), `db.close()` closes it. `db` is the Drizzle instance.

```ts
import { db, pass } from "@/core/facade";
import { users } from "@/modules/auth/database/models/user.model";

await db.insert(users).values({
  name: "Ada",
  email: "ada@example.com",
  password: await pass.hashPassword("secret"),
});
const rows = await db.select().from(users);
```

`drizzle.config.ts` points to the SQLite file (default as configured in `.env`).

## Schema

Models are defined in `modules/*/database/models/*.model.ts`. The maker CLI aggregates them into `src/database/schema.ts`. Import models directly from their module files in app code.

Migrations are generated to `src/database/migrations/sqlite/` by the maker CLI.

## Models

```ts
// src/modules/blog/database/models/post.model.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default("current_timestamp"),
});
```

## Pagination

Helpers return a nexgen-style envelope:

```ts
await paginate.table(users, {
  page: 2, perPage: 15, path: "/users",
  where: sql`active = true`,
});

await paginate.model({
  page: 1, perPage: 20,
  table: users,
  query: db.query.users,
  where: sql`role_id = 1`,
  with: { posts: true },
  orderBy: (t, { desc }) => desc(t.createdAt),
});
```

## Seeders

Seeders live at `modules/*/database/seeders/*.seed.ts`. Each exports `table` and a default async runner:

```ts
import { users } from "@/modules/auth/database/models/user.model";

export const table = users;

export default async () => {
  // insert rows...
};
```

Run with the maker CLI. See [Database Commands](../cli/database.md).
