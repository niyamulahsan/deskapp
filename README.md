<p align="center">
  <a href="https://github.com/niyamulahsan/deskapp">
    <img alt="deskapp" src="https://raw.githubusercontent.com/niyamulahsan/deskapp/main/logo-favicon/deskapp.png" width="300">
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/niyamulahsan/deskapp/main/logo-favicon/deskapp.png" alt="Deskapp" width="128" />
</p>

<p align="center">
  <a href="https://niyamulahsan.github.io/deskapp"><img src="https://img.shields.io/badge/docs%20%7C%20deskapp-3b8eed" alt="Documentation"></a>
  <a href="https://www.npmjs.com/package/@niyamulahsan/create-deskapp"><img src="https://img.shields.io/npm/v/@niyamulahsan/create-deskapp" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@niyamulahsan/create-deskapp"><img src="https://img.shields.io/npm/dt/@niyamulahsan/create-deskapp" alt="npm downloads"></a>
  <a href="https://github.com/niyamulahsan/deskapp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
  <a href="https://github.com/niyamulahsan/deskapp"><img src="https://img.shields.io/github/stars/niyamulahsan/deskapp?style=social" alt="GitHub Stars"></a>
</p>

# Deskapp

Deskapp is a desktop application framework built on **Electron + Vue 3** with TypeScript. It provides a complete, opinionated starting point for building cross-platform desktop apps with native windows, IPC bindings, SQLite/Drizzle, queues, schedulers, and more.

## Quick Start

```bash
npm create @niyamulahsan/deskapp@latest my-app
cd my-app
npm install
npm run dev
```

A desktop window opens with the starter dashboard, backed by the full local stack (SQLite, queue, cron, storage, Playwright) exposed through bindings.

## Features

| Category         | What you get                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Windows**      | Window presets, manager, native chrome, dialogs via `win`/`chrome`                                                          |
| **Bindings**     | Backend controllers auto-registered and callable from the UI via IPC as `md.module.controller.handler()` or `bindings[...]` |
| **Storage**      | App-managed storage (private/tmp) and file utilities                                                                        |
| **Database**     | SQLite + Drizzle ORM, generated schema and migrations                                                                       |
| **Queue**        | In-process job queue                                                                                                        |
| **Scheduler**    | Cron-based task scheduling with croner                                                                                      |
| **Validation**   | Zod-powered request validation                                                                                              |
| **Security**     | Bcrypt password hashing                                                                                                     |
| **Automation**   | Playwright support for browser automation                                                                                   |
| **UI**           | Vue 3 + Vite with hot reload                                                                                                |
| **CLI**          | Maker commands for modules, controllers, models, migrations                                                                 |
| **Distribution** | Package with electron-builder for Windows, macOS, and Linux                                                                 |

## Architecture

```
src/
├── main.ts            # Electron main process entrypoint
├── preload.ts         # Preload script exposing bindings
├── core/              # Framework: facade, bindings, database, queue,
│                      # scheduler, storage, validation, password, playwright,
│                      # maker CLI
├── modules/           # Application modules (auto-discovered)
├── database/          # Generated schema + SQLite migrations
├── storage/           # App-managed data (private, tmp) - gitignored
├── ui/                # Vue 3 + Vite frontend (renderer)
├── window/            # Window presets, manager, native chrome, dialogs
└── icons/             # App icons
```

## Documentation

Full documentation is available in [packages/docs](./packages/docs) or online at the docs site.

## Contributing

Contributions are welcome. Open an issue or pull request on [GitHub](https://github.com/niyamulahsan/deskapp).

## Donate

If Deskapp helps you build faster, consider supporting the project:

<p>
  <a href="https://www.supportkori.com/niyam" target="_blank">
    <img src="https://img.shields.io/badge/Local-Bangladesh-ff6f00?style=for-the-badge&logo=taka&logoColor=white" alt="Local Bangladesh (bKash/Nagad)">
  </a>
  <a href="./DONATE.md#-international-bank-transfer">
    <img src="https://img.shields.io/badge/International-Bank_Transfer-0070ba?style=for-the-badge&logo=bank&logoColor=white" alt="International Bank Transfer">
  </a>
</p>

See [DONATE.md](./DONATE.md) for full details (bKash, Nagad, Support Kori, and SWIFT/BIC).

## License

[MIT](./LICENSE)
