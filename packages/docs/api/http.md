# `http` — remote HTTP calls

Imported from the facade: `import { http } from "@/core/facade.ts"`.

Call a remote HTTP(S) API from the **main process** (a controller, job, schedule or any backend code). The base URL is `API_URL` from the runtime `.env`, so one build works for local and production, and a request **never throws** — an unreachable server returns `{ ok: false, offline: true }`. See [Calling a Server API](../guide/remote-api).

## Signature

| Member          | Signature                                                          | Description                                                       |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `get`           | `<T>(path, options?) => Promise<HttpResult<T>>`                    | `GET`                                                             |
| `post`          | `<T>(path, options?) => Promise<HttpResult<T>>`                    | `POST`                                                            |
| `put`           | `<T>(path, options?) => Promise<HttpResult<T>>`                    | `PUT`                                                             |
| `patch`         | `<T>(path, options?) => Promise<HttpResult<T>>`                    | `PATCH`                                                           |
| `delete`        | `<T>(path, options?) => Promise<HttpResult<T>>`                    | `DELETE`                                                          |
| `request`       | `<T>(path, options?) => Promise<HttpResult<T>>`                    | Any method via `options.method`                                   |
| `baseUrl`       | `() => string`                                                     | The configured `API_URL` (no trailing slash), or `""`             |
| `resolveUrl`    | `(path: string) => string`                                         | Join a path to the base (absolute URLs pass through); `""` if none |
| `client`        | `AxiosInstance`                                                    | The raw axios instance (interceptors, `defaults`, `client.get` …) |

## The envelope

Every call resolves to the same shape — branch on it instead of wrapping in `try/catch`:

```ts
interface HttpResult<T = unknown> {
  ok: boolean;      // true for a 2xx response
  status: number;   // HTTP status, or 0 when the server was never reached
  data: T | null;   // the parsed body
  url: string;      // the final URL that was called
  offline?: boolean;// true when the server could not be reached (no response)
  error?: string;   // present when offline (or when path is missing)
}
```

## Options

```ts
interface HttpOptions {
  method?: string;                                        // used by request()
  body?: unknown;                                         // object → JSON-encoded, Content-Type set for you
  token?: string | null;                                  // sets Authorization: Bearer <token>
  headers?: Record<string, string>;                       // extra headers (never overwrite an explicit Authorization)
  query?: Record<string, string | number | boolean | null | undefined>;
  timeout?: number;                                       // milliseconds
}
```

## Use cases

### `GET` with a bearer token

```ts
import { http } from "@/core/facade.ts";

const res = await http.get<{ data: { balance: number } }>("/api/wallet/balance", { token });
if (!res.ok) return res;
console.log(res.data?.data.balance);
```

### `POST` a JSON body

`body` is an object; `http` JSON-encodes it and sets `Content-Type: application/json`.

```ts
const login = await http.post("/api/auth/login", { body: { email, password } });
const accessToken = (login.data as any)?.access_token;
```

### Call an absolute URL

A full `http(s)://…` path ignores the base — handy for a third-party endpoint.

```ts
await http.get("https://jsonplaceholder.typicode.com/todos/1");
```

### Query-string parameters

```ts
await http.get("/api/orders", { query: { page: 1, per_page: 25, search: "paid" } });
```

### Set a timeout / attach an interceptor

Use the raw client for defaults or interceptors that apply to every call.

```ts
http.client.defaults.timeout = 30_000;

http.client.interceptors.request.use((config) => {
  config.headers.set("X-Client", "deskapp");
  return config;
});
```

## The base URL

`http` reads `API_URL` on every call (`process.env.API_URL`, falling back to
`VITE_API_URL`). A missing scheme is filled in: a local host gets `http://`, any
other host gets `https://`.

```sh
# .env
API_URL=http://localhost:3000        # dev
# API_URL=wallet.example.com         # → https://wallet.example.com
```

Leave it empty to run fully offline — a relative call then returns
`{ ok: false, offline: true }`.

## Notes

- `http` is **main-process only**. The renderer (a page or store) reaches the server through a binding — see [Controllers & Bindings](../guide/controllers).
- HTTP errors (4xx/5xx) **resolve**; `ok` is `false` but the response body is in `data`. Only a network failure sets `offline: true`.
- The template exposes `http` to the UI as `app.net.apiFetch` in `src/modules/app/controllers/net.controller.ts`.

## Related

- [queue](./queue) · [validate](./validate) · [Calling a Server API](../guide/remote-api)
