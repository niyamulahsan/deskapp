# @niyam/deskapp

> Batteries-included desktop application framework for Deno. One command
> scaffolds a native desktop app: a Deno backend (window manager, native APIs,
> storage, SQLite + Drizzle ORM, queue, scheduler, validation, password
> hashing, Playwright) behind a Vue 3 + Vite UI.

[Documentation](https://niyamulahsan.github.io/deskapp) · [GitHub](https://github.com/niyamulahsan/deskapp) · [MIT License](https://github.com/niyamulahsan/deskapp/blob/main/LICENSE)

---

## 🎯 Features

`@niyam/deskapp` is a full local-first desktop framework. It scaffolds a
complete project — not a UI shell — with the backend and frontend wired
together in-process. Everything lives behind **one import** — the facade at
`@/core/facade.ts` — which exposes a namespace object per capability (`win`,
`chrome`, `pickers`, `db`, `queue`, `cron`, `storage`, …), so your window,
database, queue, and scheduler are available everywhere.

## ✨ Highlights

### Desktop

- **Windows & native APIs** — window presets, manager, native chrome, dialogs
  and file pickers via the `win` / `chrome` / `pickers` facade objects
- **Bindings** — backend controllers auto-registered and callable from the UI
  in-process as `bindings['<module>.<controller>.<handler>']()`

### Data

- **SQLite + Drizzle ORM** — type-safe database access with auto-generated
  schema and migrations
- **Storage** — private / public / tmp app stores with JSON + file helpers

### Services

- **Queue** — recursive, resumable queue with status tracking
- **Scheduler** — cron-based task scheduling built into the facade

### Security

- **Validation** — Zod-powered request validation
- **Password** — Bcrypt hashing (plus CORS and rate limiting)

### UI & Automation

- **Vue 3 + Vite** — run a dev server with HMR or serve the built SPA from the
  backend
- **Playwright** — drive webview tabs and external pages

### Distribution

- **Maker CLI** — commands for modules, controllers, models, seeds, schema,
  migrations, UI, and bundling
- **Native apps** — per-OS folder apps and binaries (`deno task maker bundle:*`)

## 🎯 Use Cases

- Local-first productivity and data tools
- Internal desktop dashboards on Windows, macOS, and Linux
- Apps that want webview rendering without shipping Chromium by default
- One-codebase desktop apps with a Vue 3 interface

## 📦 Installation

### Deno

```sh
mkdir my-app
cd my-app
deno create jsr:@niyam/deskapp
deno install
deno task dev
```

## 🚀 Quick Start

A desktop window opens with the starter dashboard, backed by the full local
stack. Access every subsystem through one import — the facade:

```ts
import { win, queue, storage } from "./src/core/facade.ts";

win.getWindow()?.setTitle("Hello"); // drive windows
const q = queue.create({ concurrency: 3 }); // throttle async work
await q.add(async () => "task done");
await storage.put("data/hello.json", { hello: "world" });
```

Run headless as a tray-only service with `deno run -A src/main.ts`.

## 🌍 Compatibility

| Environment | Version | Status          |
| ----------- | ------- | --------------- |
| **Deno**    | 2.9+    | Fully supported |
| **Windows** | —       | Fully supported |
| **macOS**   | —       | Fully supported |
| **Linux**   | —       | Fully supported |

## 📚 Documentation

Complete documentation is available at **[deskapp.dev](https://niyamulahsan.github.io/deskapp)**
(guide, API reference, CLI). Source and changelog live on
[GitHub](https://github.com/niyamulahsan/deskapp).
