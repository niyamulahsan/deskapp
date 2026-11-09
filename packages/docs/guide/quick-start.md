# Quick Start

## Prerequisites

- **Node.js** 18+ and npm
- A desktop OS: **Windows**, **macOS** or **Linux**

::: warning Windows: Smart App Control
On **Windows**, unpackaged/dev builds are typically unsigned. With Smart App Control (SAC) or SmartScreen enabled, Windows may warn about unsigned executables. If blocked, use "More info → Run anyway" or disable SAC if needed for development.
:::

## Create a project

Use `create-deskapp` to scaffold a new project:

```sh
npm create deskapp@latest my-app
# or
npx create-deskapp my-app
```

Follow the prompts if any, then `cd my-app`.

This copies the full Electron-based template into your project, creates a `.env` from `.env.example`, and installs dependencies.

## Install dependencies

If dependencies weren't installed automatically, run:

```sh
npm install
```

## Run it

```sh
npm run dev
```

`dev` runs the UI dev server, builds the Electron main/preload in watch mode, and launches Electron. With hot reload for the UI, you can develop your app quickly. You should see the main window with the demo dashboard.

### Headless (no window)

Set `DESKAPP_UI=false` in `.env`, then run:

```sh
npm run dev
```

The app boots in headless/tray mode with no window. The process stays alive via the system tray.

## What you get

```
my-app/
  .vscode/             editor settings
  scripts/             build scripts
  src/
    core/              framework internals
    database/          generated schema + migrations
    icons/             favicon, tray, app icons
    modules/           your modules (app by default)
    storage/           live database and files folder
    ui/                Vue 3 frontend (Vite)
    window/            window presets / manager / native chrome / dialogs
    main.ts            Electron main process entrypoint
    preload.ts         preload script exposing bindings
  .env                 created from .env.example
  package.json         scripts, dependencies, electron-builder config
  tsconfig.json        TypeScript config
  drizzle.config.ts    database setup
```

## Try the CLI

The template includes a maker CLI for scaffolding:

```sh
npx deskapp maker                    # list all commands
npx deskapp maker make:module blog   # create a new module with a model + seeder
npx deskapp maker db:migrate         # generate + run migrations
```

Or add scripts to `package.json` as needed. See [Maker Commands](../cli/maker.md) and [Database Commands](../cli/database.md).

## Build & Package

```sh
npm run build      # Build UI and Electron main/preload
npm run package    # Build and package with electron-builder
```

Packaged apps will be in the `release/` directory.

## Next

- [Architecture](./architecture.md)
- [Environment](./environment.md) — env variables
- [Configuration](./configuration.md) — windows, config
