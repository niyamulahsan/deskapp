# `session` — main-process session store

Imported from the facade: `import { session } from "@/core/facade.ts"`.

A small keyed key/value store for the **main process** — the deskapp counterpart of nexwire's framework `session`. Keep per-user state here (an auth token, a wizard step, a small cache) instead of in the renderer, which never sees it. See [Calling a Server API](../guide/remote-api#authentication).

- **In-memory first** — reads and writes are synchronous and never throw.
- **Encrypted at rest when possible** — when Electron's `safeStorage` is available the store is written to `<userData>/session.enc` (ciphertext) and restored on the next launch; in a plain Node/dev/test process it is memory only and `session.persistent()` reports `false`.
- **Values must be JSON-serialisable** — that is what persistence stores.

## Signature

| Member        | Signature                            | Description                                              |
| ------------- | ------------------------------------ | -------------------------------------------------------- |
| `DEFAULT`     | `string`                             | The app's own session id (`"default"`)                   |
| `start`       | `(data?, { ttlMs? }) => string`      | Create a session and return its id                       |
| `all`         | `<T>(id) => T \| null`               | The whole session object                                 |
| `get`         | `<T>(id, key) => T \| null`          | One key of a session                                     |
| `set`         | `(id, key, value) => boolean`        | Write one key (creates the session when it is missing)   |
| `merge`       | `(id, data) => boolean`              | Merge several keys at once                               |
| `refresh`     | `(id, ttlMs?) => boolean`            | Extend the TTL, or clear it with `0`                     |
| `destroy`     | `(id) => boolean`                    | Delete one session; true when it existed                 |
| `flush`       | `() => boolean`                      | Delete every session                                     |
| `isAvailable` | `() => boolean`                      | Always `true` — the in-memory store works everywhere     |
| `persistent`  | `() => boolean`                      | True when sessions are encrypted and restored on launch  |

## Use

```ts
import { session } from "@/core/facade.ts";

// The app's own session — one per app instance.
const id = session.DEFAULT;
session.merge(id, { accessToken: "…", user: { id: 1 } });
session.get<string>(id, "accessToken"); // "…"

// A second, isolated session with a 30-minute TTL.
const wizard = session.start({ step: 1 }, { ttlMs: 30 * 60_000 });
session.set(wizard, "step", 2);
session.refresh(wizard, 30 * 60_000);
session.destroy(wizard);
```

## TTL

`ttlMs` defaults to `0`, which never expires. A non-zero value expires the session
lazily — the next read after the deadline returns `null` and drops the entry.
`refresh(id, 0)` clears an existing TTL.

## Persistence

`safeStorage` is only available once Electron is ready, and only on a real desktop
runtime. When it is not (`persistent()` is `false`), the store still works for the
life of the process; nothing is written to disk, so no token is ever left in
plaintext.

## Related

- [`http`](./http) · [`auth`](./auth) · [Calling a Server API](../guide/remote-api)
