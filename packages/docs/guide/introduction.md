# Introduction

**Deskapp** is a desktop application framework for TypeScript on [Deno Desktop](https://docs.deno.com/runtime/desktop/). It gives you a complete, opinionated starting point for building a real cross-platform desktop app:

- Native windows with presets, plus system tray, application menus, context menus and dialogs
- A **bindings** system that auto-registers every backend controller handler on the window, so the UI calls the backend in-process — no HTTP, no IPC plumbing
- SQLite via [Drizzle ORM](https://orm.drizzle.team), with schema generation, migrations and [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination
- A two-layer storage API: unlimited user-file operations plus an app-managed private/tmp area
- In-process job queue and cron scheduling
- A Vue 3 + Vite frontend with Bootstrap, already wired to the `bindings` global
- A maker CLI for scaffolding modules, models, seeders and controllers, and a bundler that ships a runnable app folder (plus optional bundled Chromium) for each OS

## The mental model

```
┌─────────────────────────────┐
│  Deno backend (src/main.ts) │  windows · db · native · queue · cron
│          │  bindings (in-process)        │
│  Vue 3 webview (src/ui)     │  calls bindings['<module>.<controller>.setTitle']()
└─────────────────────────────┘
```

Everything runs in one Deno process. `src/main.ts` is the backend entrypoint, `src/ui` is the frontend, and the two communicate through auto-registered bindings rather than a network layer.

```ts
// In a controller (backend):
import { win } from "@/core/facade.ts";

export const setTitle = (title: string) => {
  win.getWindow()?.setTitle(title);
  return { ok: true, title };
};
export const handlers = { setTitle };
```

```ts
// In the UI:
await bindings["<module>.<controller>.setTitle"]("New Title");
```

## Directory layout

A scaffolded project is a complete, self-contained folder (it IS the `template/` of the package, copied as-is):

```
.vscode/               editor settings for Deno
src/
  window/              window presets, manager, native chrome, dialogs
  core/                framework: factory, bindings registry, database,
                       queue, scheduler, storage, validation, password,
                       playwright, maker CLI, bundle script
  database/            generated schema + SQLite migrations
  extensions/          holds extensions
  icons/               shared app icons (favicon, tray, png sets)
  modules/             your app's modules (controllers, models, seeders)
  storage/             app-managed data (private, tmp) - gitignored
  ui/                  Vue 3 + Vite frontend
  main.ts              backend entrypoint (Deno.serve + window boot)
.env / .env.example    environment
deno.json              tasks, desktop config, imports
drizzle.config.ts      Drizzle Kit configuration (SQLite)
```

The `@niyam/deskapp` JSR package is the _scaffold_: it ships this template plus a small `./create` script that copies it into your project. This docs site is separate and never part of a scaffolded app.

## Next steps

- [Quick Start](./quick-start.md) — scaffold a project in two minutes
- [Architecture](./architecture.md) — how the pieces fit together
- [Controllers & Bindings](./controllers.md) — the core UI→backend bridge
