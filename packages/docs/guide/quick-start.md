# Quick Start

## Prerequisites

- **Deno** 2.9+ (or latest stable) — needed for `deno create` and Deno Desktop.
- A desktop OS: **Windows**, **macOS** or **Linux** (the framework uses each platform's native APIs).

## Create a project

Create a folder, step into it, and scaffold:

```sh
mkdir my-app
cd my-app
deno create jsr:@niyam/deskapp
```

This downloads the `@niyam/deskapp` package from JSR and runs its `./create` scaffold script. Your whole framework + starter app is copied into the current folder (named after it), a `.env` is created from `.env.example`, and everything is ready to run.

::: tip
- The `jsr:` prefix is required — `deno create deskapp` by itself is not supported.
- Alternatively, scaffold from anywhere with an explicit name:
  `deno run -A jsr:@niyam/deskapp/create my-app` (add `--force` to overwrite an existing folder).
:::

## Install dependencies

The project resolves npm packages (Vite, Sass, Drizzle, Vue, ...) through Deno:

```sh
cd my-app
deno install
```

## Run it

```sh
deno task dev
```

`dev` runs codegen (schema + bindings), builds the UI, then opens the desktop app with HMR while Vite rebuilds the UI in watch mode — edited SCSS/Vue files refresh the open window automatically. You should see the main window with the demo dashboard — file operations, API proxy, Playwright button, queue and cron demos — all working against the real backend.

### Headless (no window)

Set `DESKAPP_UI=false` in `.env` to disable the frontend, then:

```sh
deno task serve        # codegen, then: deno run -A --env-file src/main.ts
```

The app boots as a tray-only background service: no UI, no window. The HTTP server serves a small JSON status at `http://127.0.0.1:8000` and the tray keeps the process alive. (Note `DESKAPP_UI` defaults to `true` — without `.env` a plain `deno run -A src/main.ts` opens the window.)

## What you get

```
my-app/
  .vscode/             editor settings for Deno
  src/
    core/              framework internals (edit freely — it's your framework)
    database/          generated schema + migrations
    icons/             favicon, tray, app icons
    modules/           your modules (app by default)
    storage/           live database and files folder
    ui/                Vue 3 frontend
    window/            window presets / manager / native chrome / dialogs
    main.ts            backend entrypoint
  .env                 created from .env.example
  deno.json            app name, tasks, desktop config, dependencies
  drizzle.config.ts    database setup
```

## Rename your app

The app display name and deep-link scheme come from `deno.json`:

```json
"desktop": {
  "app": {
    "name": "MyApp",
    "deepLinks": ["myapp"]
  }
}
```

Change those (and the icon files in `src/icons/`), and you're done.

## Try the CLI

```sh
deno task maker                    # list all commands
deno task maker make:module blog   # create a new module with a model + seeder
deno task maker db:migrate         # generate + run migrations
```

See [Maker Commands](../cli/maker.md) and [Database Commands](../cli/database.md).

## Next

- [Architecture](./architecture.md)
- [Environment](./environment.md) — env variables
- [Configuration](./configuration.md) — windows, tasks, deno.json
