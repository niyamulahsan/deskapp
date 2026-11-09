# Introduction

**Deskapp** is a desktop application framework for TypeScript built on [Electron](https://www.electronjs.org/). It gives you a complete, opinionated starting point for building a real cross-platform desktop app:

- Native windows with presets, plus system tray, application menus, context menus and dialogs
- A **bindings** system that auto-registers every backend controller handler on the window, so the UI calls the backend in-process — no HTTP, no IPC plumbing
- SQLite via [Drizzle ORM](https://orm.drizzle.team), with schema generation, migrations and [nexgen](https://niyamulahsan.github.io/nexgen/)-style pagination
- A two-layer storage API: unlimited user-file operations plus an app-managed private/tmp area
- In-process job queue and cron scheduling
- A Vue 3 + Vite frontend with Bootstrap, already wired to the `bindings` global
- A maker CLI for scaffolding modules, models, seeders and controllers, and a bundler that ships a runnable app folder (plus optional bundled Chromium) for each OS

::: warning Windows: Smart App Control
On **Windows**, unpackaged/dev builds are typically unsigned. With Smart App Control (SAC) or SmartScreen enabled, Windows may warn about unsigned executables. If blocked, you can disable SAC (Settings → Privacy & Security → Windows Security → App & browser control → Smart App Control → Off) or use "More info → Run anyway" when prompted. For distribution, consider code signing your builds.
:::

## The mental model

```
┌─────────────────────────────────────────┐
│  Electron main process (src/main.ts)    │  windows · db · native · queue · cron
│                     bindings (IPC)      │
│  Vue 3 renderer (src/ui)                │  calls bindings['<module>.<controller>.setTitle']()
└─────────────────────────────────────────┘
```

Everything runs in the Electron main process. `src/main.ts` is the backend entrypoint, `src/ui` is the frontend (renderer), and the two communicate through secure IPC with auto-registered bindings exposed via a preload script.

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

A scaffolded project is a complete, self-contained Electron app (based on the template):

```
.vscode/               editor settings
scripts/               build scripts (esbuild for main/preload)
src/
  window/              window presets, manager, native chrome, dialogs
  core/                framework: bindings registry, database,
                       queue, scheduler, storage, validation, password,
                       playwright, maker CLI
  database/            generated schema + SQLite migrations
  extensions/          holds extensions
  icons/               shared app icons (favicon, tray, png sets)
  modules/             your app's modules (controllers, models, seeders)
  storage/             app-managed data (private, tmp) - gitignored
  ui/                  Vue 3 + Vite frontend
  main.ts              Electron main process entrypoint
  preload.ts           preload script exposing bindings to renderer
.env / .env.example    environment
package.json           scripts, dependencies, electron-builder config
tsconfig.json          TypeScript config
drizzle.config.ts      Drizzle Kit configuration (SQLite)
```

The `create-deskapp` package scaffolds this template. This docs site is separate and never part of a scaffolded app.

## Next steps

- [Quick Start](./quick-start.md) — scaffold a project in two minutes
- [Architecture](./architecture.md) — how the pieces fit together
- [Controllers & Bindings](./controllers.md) — the core UI→backend bridge
