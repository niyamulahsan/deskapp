# `auth` — bearer auth client (app config)

Lives at **`src/config/auth.ts`** — **your** file, not framework internals. Edit it to match your server. It holds the deskapp ⇄ server auth **contract** and the client that honours it.

`src/main.ts` imports it once at boot:

```ts
import "@config/auth"; // installs the bearer + refresh interceptors on http.client
```

That single import is what makes every `http` call authenticated — no per-module wiring, no controller dependency. Any module just calls `http.get` / `http.post` and the token rides along; a `401` triggers one silent refresh + retry. The `app.auth.*` bindings are the thin controller on top (`src/modules/app/controllers/auth.controller.ts`).

See [Calling a Server API](../guide/remote-api#authentication) for the walkthrough, and [`session`](./session) for where the token pair is stored.

## The contract — edit this

Everything the client needs to know about *your* server is in `AUTH`, at the top of the file. Change a token field name, an endpoint, the header, or the whole response shape here — nothing else needs to change.

```ts
export const AUTH = {
  // Endpoints, relative to API_URL (absolute http(s):// passes through).
  paths: {
    login: "/api/auth/login",
    refresh: "/api/auth/refresh-token",
    logout: "/api/auth/logout",
    me: "/api/auth/me"
  },

  // Session-store keys (main process only; never the renderer).
  keys: { access: "accessToken", refresh: "refreshToken", user: "user" },

  // The request header the access token rides in.
  header: { name: "Authorization", scheme: "Bearer" },

  // The body sent to paths.refresh.
  refreshBody(refreshToken) {
    return { refresh_token: refreshToken };
  },

  // Pull the token pair + user out of a login/refresh response body.
  // `payload` is the server's `data` (the { message, data } envelope is unwrapped).
  readTokens(payload) {
    const p = payload ?? {};
    return {
      access: typeof p.access_token === "string" ? p.access_token : null,
      refresh: typeof p.refresh_token === "string" ? p.refresh_token : null,
      user: p.user ?? null
    };
  }
};
```

| Field         | Change it when…                                                                 |
| ------------- | ------------------------------------------------------------------------------- |
| `paths`       | your routes differ from nexwire's `/api/auth/*`                                 |
| `keys`        | you want different names in the `session` store                                 |
| `header`      | the token goes in another header (`X-Api-Key`), or with no scheme                |
| `refreshBody` | the refresh endpoint names its field differently (e.g. `token`)                 |
| `readTokens`  | the response shape differs (nested `tokens`, different field names, …)          |

## Exports

| Member                        | Signature                            | Description                                                    |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `AUTH`                        | `const`                              | The contract above — edit it for your server                   |
| `install`                     | `() => void`                         | Attach the interceptors to `http.client` (idempotent; runs on import) |
| `storeTokens`                 | `(payload) => void`                  | Persist the pair + user read by `AUTH.readTokens`              |
| `saveUser`                    | `(user) => void`                     | Cache the signed-in user                                       |
| `accessToken`                 | `() => string \| null`               | The stored access token                                        |
| `currentUser`                 | `() => AuthUser`                     | The stored user                                                |
| `clearSession`                | `() => void`                         | Forget the pair + user                                         |
| `refreshTokens`               | `() => Promise<boolean>`             | Rotate the pair once (concurrent callers share one rotation)   |

Types: `AuthUser`, `AuthTokens`, `TokenPayload`, `AuthResult`.

## What the interceptors do

- **Request** — attaches `<scheme> <access token>` to every `http` call. It never overrides an explicit header you set yourself (so `http.get(path, { token })` still wins for a different identity), but it does replace its own stale header when retrying after a refresh.
- **Response** — turns a `401` into one silent `POST <paths.refresh>` + retry. A `401` from `paths.login` or `paths.refresh` is *not* treated as a stale token (that is bad credentials). Concurrent `401`s share a single rotation; if the refresh fails, the session is cleared.

## Related

- [`session`](./session) · [`http`](./http) · [Calling a Server API](../guide/remote-api)
