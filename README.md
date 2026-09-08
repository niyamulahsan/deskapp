<p align="center">
  <a href="https://deskapp.dev">
    <img alt="deskapp" src="logo-favicon/deskapp.png" width="300">
  </a>
</p>

<h3 align="center">Desktop application framework for modern desktop apps</h3>

<p align="center">
  <a href="https://niyamulahsan.github.io/deskapp"><img src="https://img.shields.io/badge/docs-deskapp.dev-2c9c8a" alt="Documentation"></a>
  <a href="https://jsr.io/@niyam/deskapp"><img src="https://img.shields.io/jsr/v/@niyam/deskapp" alt="JSR version"></a>
  <a href="https://github.com/niyamulahsan/deskapp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  <a href="https://github.com/niyamulahsan/deskapp"><img src="https://img.shields.io/github/stars/niyamulahsan/deskapp?style=social" alt="GitHub Stars"></a>
</p>

---

deskapp is a batteries-included desktop framework built on **Deno Desktop**: a Deno backend (window manager, native APIs, storage, SQLite + Drizzle, queue, scheduler, validation, password hashing, Playwright automation) behind a **Vue 3 + Vite** frontend — all scaffolded with a single command and distributed as native per-OS folder apps.

## Quick Start

```bash
mkdir my-app
cd my-app
deno create jsr:@niyam/deskapp
deno install
deno task dev
```

A desktop window opens with the starter dashboard, backed by the full local stack (SQLite, queue, cron, storage, Playwright) exposed through the `app` facade.

Requires **Deno >= 2.9** and a desktop OS (Windows, macOS, or Linux).

### Headless

Run without a window as a tray-only background service:

```bash
deno run -A src/main.ts
```

### Runtime

| Tool     | Minimum version | Notes                                                                  |
| -------- | --------------- | ---------------------------------------------------------------------- |
| **Deno** | `>= 2.4`        | `deno create` scaffolds the starter; `deno task maker` runs everything |

## Features

| Category         | What you get                                                             |
| ---------------- | ------------------------------------------------------------------------ |
| **Windows**      | Window presets, manager, native chrome, dialogs — all via `app.window.*` |
| **Bindings**     | Backend controllers auto-registered and callable from the UI in-process  |
| **Storage**      | Private / public / tmp app storage with JSON + file helpers              |
| **Database**     | SQLite + Drizzle ORM, generated schema and migrations                    |
| **Queue**        | Recursive, resumable queue with status tracking                          |
| **Scheduler**    | Cron-based task scheduling                                               |
| **Validation**   | Zod-powered request validation                                           |
| **Security**     | Bcrypt password hashing, CORS, rate limiting                             |
| **Automation**   | Playwright control of webview tabs and external pages                    |
| **UI**           | Vue 3 + Vite — run a dev server with HMR or serve the built SPA          |
| **CLI**          | Maker commands for modules, controllers, models, seeds, bundling         |
| **Distribution** | Native folder apps / binaries per OS (`bundle:*`)                        |

## Architecture

```
src/
├── main.ts            # Backend entrypoint (Deno.serve + window boot)
├── core/              # Framework: facade, bindings, database, queue,
│                      # scheduler, storage, validation, password, playwright,
│                      # maker CLI, bundle script
├── modules/           # Application modules (auto-discovered)
├── database/          # Generated schema + SQLite migrations
├── storage/           # App-managed data (private, tmp) — gitignored
├── ui/                # Vue 3 + Vite frontend
└── icons/             # Favicon, tray, app icons
```

### Modules

Every feature is a self-contained module under `src/modules/<name>/`:

```
src/modules/app/
├── controllers/       # Window-bound handlers (auto-registered bindings)
├── database/
│   ├── models/        # Drizzle table definitions
│   └── seeders/       # Test data generators
└── migrations/        # Per-module SQLite migrations
```

Modules are **auto-discovered** — no manual registration. Create one with:

```bash
deno task maker make:module blog
deno task maker make:controller blog post
deno task maker make:model blog post
deno task maker make:seeder blog post
```

### Framework Facade

Access all subsystems through a single import:

```ts
import { app } from "./src/core/facade.ts";

await app.storage.write("data", { hello: "world" });
await app.queue.push("sum", { a: 1, b: 2 });
await app.net.fetchJson("https://jsonplaceholder.typicode.com/todos/1");
```

## CLI Reference

| Command                           | Description                              |
| --------------------------------- | ---------------------------------------- |
| `deno task dev`                   | Codegen + build UI + open desktop window |
| `deno task ui`                    | Run the Vue dev server (HMR)             |
| `deno run -A src/main.ts`         | Headless, tray-only service              |
| `deno task test`                  | Run Deno tests                           |
| `deno task maker`                 | List all maker commands                  |
| `deno task maker make:module <n>` | Scaffold a new module                    |
| `deno task maker bindings:gen`    | Regenerate the UI bindings               |
| `deno task maker db:schema`       | Regenerate `src/database/schema.ts`      |
| `deno task maker db:migrate`      | Generate + run migrations                |
| `deno task maker db:seed`         | Run all seeders                          |
| `deno task maker db:studio`       | Launch Drizzle Studio                    |
| `deno task maker bundle:win`      | Bundle a Windows folder app              |

## Distribution

Desktop apps ship as native folder apps. From a machine of the target OS:

```bash
deno task maker bundle:win
deno task maker bundle:mac
deno task maker bundle:linux --chromium=force   # self-contained browser for Linux
```

Artifacts land in `dist/` (`.app` bundle on macOS, folder app on Windows/Linux).

## Documentation

Complete documentation is available at **[deskapp.dev](https://niyamulahsan.github.io/deskapp)**.

## Contributing

Contributions are welcome. Open an issue or pull request on [GitHub](https://github.com/niyamulahsan/deskapp).

## Donate

If deskapp helps you build faster, consider supporting the project:

<p>
  <a href="https://www.supportkori.com/niyam" target="_blank">
    <img src="https://img.shields.io/badge/Support-Kori-ff6f00?style=for-the-badge&logo=kofi&logoColor=white" alt="Support Kori">
  </a>
  <a href="https://github.com/sponsors/niyamulahsan">
    <img src="https://img.shields.io/badge/GitHub-Sponsors-ea4aaa?style=for-the-badge&logo=github" alt="GitHub Sponsors">
  </a>
</p>

## License

deskapp is open-sourced software licensed under the [MIT license](LICENSE).
