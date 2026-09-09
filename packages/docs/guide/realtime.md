# Realtime (Pulse)

Realtime events are **server-driven**: your **server engine** (the API backend with auth, Socket.IO, cron, and queue) does the work — an HTTP call, webhook, cron or queued job — then pushes the result to the user's Socket.IO rooms. The desktop app's Vue UI consumes those events through a **Pulse** client: a faithful port of the engine frontend's `pulse.ts` socket plugin.

```
webhook / API call ──▶ engine backend ── Socket.IO event ──▶ Vue Pulse client ──▶ component state / toasts
```

## Pulse client

`src/ui/src/plugins/pulse.ts` exports a singleton `pulse` client and a `PulsePlugin`. `src/ui/src/app.ts` installs the plugin and re-exports the singleton:

```ts
import { pulse, PulsePlugin } from "./plugins/pulse.ts"; // src/ui/src/app.ts
export { pulse };
createApp(App).use(PulsePlugin).mount("#app");
```

The full file is reproduced in [UI → Changing the frontend → Reference](./ui#changing-the-frontend).

In components, import the singleton directly (`@/ui/` maps to `src/ui/src/`):

```ts
import { pulse } from "@/ui/plugins/pulse.ts";
// Options API alternative: this.$pulse (typed via the plugin's module augmentation)
```

### API

| Member                       | Description                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `connect()` / `disconnect()` | Explicit socket lifecycle. Calling any `channel()`/`private()` auto-connects first.                    |
| `channel(name)`              | Listen on a public channel. Joins the Socket.IO room (`emit("join", name)`), returns a channel handle. |
| `private(room)`              | Alias for `channel("private:" + room)` — per-user rooms.                                               |
| `leave(room)`                | Leave the room and drop its listeners.                                                                 |
| `$pulse`                     | Global property (typed) for Options API access.                                                        |

Each channel handle:

- `listen(event, cb)` — subscribe to an event in that room; returns the handle (chainable).
- `stopListening(event, cb?)` — unsubscribe one handler (or all for that `event`).

```ts
const ui = pulse.channel("payments");
ui.listen<{ ref: string; status: string }>("payment.status", async (payload) => {
  // Backend work goes through the in-process `bindings` (webview -> controller ->
  // facade -> native/db), never HTTP. Call a controller handler you added:
  const detail = await bindings["<module>.net.fetchJson"](
    `https://api.example.com/payments/${payload.ref}`,
  );
  updatePayment({ ...payload, detail }); // then update local state / store
});
// on unmount: ui.stopListening("payment.status")
```

`bindings` is the in-process bridge (a `Proxy`, typed by `src/ui/src/bindings.d.ts`) — available only under `deno desktop`. Pure display updates can stay local; server-side work (persisting, reconciling, fetching details) should route through a backend controller via `bindings`.

After the first `channel()`/`private()`, the client connects to `socket.io-client` with `withCredentials: true` and `transports: ["websocket", "polling"]`, and tracks joined rooms so it **re-emits `join` for each room on reconnect**.

### Usage — Vue components

**Composition API** (import the singleton) — listen, update state, and tear down on unmount:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { pulse } from "@/ui/plugins/pulse.ts";

const status = ref("PENDING");
let stop = () => {};

onMounted(() => {
  const payments = pulse.channel("payments"); // auto-connects, joins "payments"
  const unsubscribe = payments.listen<{ ref: string; status: string }>(
    "payment.status",
    (payload) => {
      status.value = payload.status;
    },
  );
  stop = () => payments.stopListening("payment.status", unsubscribe);
});

onUnmounted(stop); // cleanup when the component is destroyed
</script>
```

**Options API** (the typed `$pulse` global) — keep the handler reference so `stopListening` can remove exactly that one:

```vue
<script lang="ts">
export default {
  data() {
    return { status: "PENDING" };
  },
  mounted() {
    this.payments = this.$pulse.channel("payments");
    this.onStatus = (payload) => (this.status = payload.status);
    this.payments.listen("payment.status", this.onStatus);
  },
  beforeUnmount() {
    this.payments.stopListening("payment.status", this.onStatus);
  },
};
</script>
```

**Per-user rooms + typed payloads** — `private()` is how the engine targets a single user (`private:user:42`):

```ts
const notify = pulse.private(`user:${userId}`); // joins "private:user:42"
notify.listen("trx.notify", (n: { message: string }) => showToast(n.message));
```

**Leaving a room** — `leave()` removes the listeners for that room too:

```ts
pulse.leave("payments"); // leave + drop all "payments" listeners
```

Conventions to follow in components:

- Register listeners on a channel and drop them when the component is destroyed — `onUnmounted`/`beforeUnmount` in Vue, the `useEffect` cleanup in React (reconnect re-joins rooms, but a destroyed component must not keep firing).
- Reads are safe even with no socket backend: when `__SOCKET_ENABLED__` is false, `pulse` is a no-op and every call above returns immediately — so you can wire realtime code without guarding it.

### Usage — React components (after switching)

If you switched the UI to React, the client side still works unchanged: `pulse.ts`'s socket logic (`pulse`, `createPulse`) is framework-agnostic. The Vue-only bottom of the file (`import type { App } from "vue"`, the `PulsePlugin` install block, and the `declare module "vue"` augmentation) can be deleted — React just imports the singleton and uses it inside a hook:

```tsx
import { useEffect, useState } from "react";
import { pulse } from "@/ui/plugins/pulse.ts";

export function PaymentsPanel() {
  const [status, setStatus] = useState("PENDING");

  useEffect(() => {
    const ui = pulse.channel("payments"); // auto-connects, joins "payments"
    ui.listen<{ ref: string; status: string }>(
      "payment.status",
      (payload) => setStatus(payload.status),
    );
    return () => ui.stopListening("payment.status"); // fires on unmount
  }, []);

  return <p>Payment: {status}</p>;
}
```

`useEffect`'s return value is the cleanup — it replaces Vue's `onUnmounted`/`beforeUnmount`.

**Per-user rooms + typed payloads:**

```tsx
const notify = pulse.private(`user:${userId}`); // joins "private:user:42"
notify.listen<{ message: string }>("trx.notify", (n) => toast(n.message));
```

**Leaving a room:**

```ts
pulse.leave("payments"); // leave + drop all "payments" listeners
```

There is no `$pulse` global in React — import `pulse` where needed, or provide it once via a React `Context`/`createContext(pulse)`.

### Socket URL & toggling

The client resolves its socket URL from `VITE_SOCKET_URL` → `VITE_API_URL` → `window.location.origin` (build-time). To bridge the desktop UI to your backend engine, set `VITE_SOCKET_URL` when building the UI (see [Connecting to your engine](#connecting-to-your-engine) below).

`__SOCKET_ENABLED__` is defined in `src/ui/vite.config.ts` as `true` when `VITE_SOCKET_URL` or `VITE_API_URL` is set; otherwise `pulse` is replaced by a **no-op client** — `connect`/`disconnect`/`channel`/`private`/`leave` return immediately and `listen`/`stopListening` are safe no-ops. The app continues to work without any socket backend (disable via the `PulsePlugin`/no-op path, or set `DESKAPP_UI=false` for a fully headless run).

## Connecting to your engine

The engine authenticates sockets from the access-token cookie (`framework/realtime/socket-cookie.ts`). A desktop webview can pass the same token through the Socket.IO handshake:

```ts
import { io } from "socket.io-client";

const socket = io(engineUrl, {
  auth: { token: getAccessToken() },
  withCredentials: true,
  transports: ["websocket", "polling"],
});
```

If you control the engine, extend `authFromSocketHandshake` (in `socket-cookie.ts`) to fall back to `socket.handshake.auth.token` before checking the cookie — then desktop and browser clients authenticate identically, and the engine still auto-joins `user:{id}`, `role:{role}`, and `auth` rooms.

## Presence (who's online)

Presence is owned by the **server** (the engine's Redis) — the desktop never stores it. The engine already joins every authenticated socket into `user:{id}` / `role:{role}` / `auth`; track **online** with a Redis set (e.g. `presence:online`) whose members are device/socket ids, TTL refreshed by a heartbeat and removed on `disconnect`. Keep a separate `last_seen_at` on the user/session record for **logged-in but idle**, and report both to the admin UI — "N logged in / M online now / X devices" — through the engine's HTTP API, read from the desktop via a backend binding (e.g. `bindings["<module>.net.fetchJson"](engineUrl + "/admin/presence")`).

The desktop is a **consumer, not an owner** of presence:

- Quitting the desktop app closes its socket, so the server clears its entry immediately — no stale "online" state.
- The desktop learns about its own devices/sessions by listening on its own `user:{id}` channel; it never keeps the count itself.

## Example: Payment status

1. User pays → your server receives the bKash webhook → marks the trx `SUCCESS`.
2. Server emits to the user's room:

```ts
io.to("user:" + userId).emit("payment.status", { ref, status: "SUCCESS" });
```

3. The Pulse client (listening on `payments` or the user's private room) fires the listener; the handler updates local state and/or routes through a backend binding (`bindings["<module>.<controller>.<handler>"](...)` — your own controller) — no polling, no public port on the desktop.

Keep an idempotent `GET /api/payments/:ref` as a poll fallback while a trx is `PENDING`; the socket is the fast path, the poll is the safety net.
