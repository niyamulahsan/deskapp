# Environment

Configuration comes from environment variables in `.env`. Copy `.env.example` to `.env`.

- **Development**: load with your app (e.g. `npm run dev`). The app uses `dotenv` and `loadEnv()` to find `.env` from the project root or cwd.
- **Packaged builds**: `loadEnv()` in `src/core/env.ts` searches for `.env` next to the executable, in `APP_BASE_DIR`, or common locations. Variables already present in the environment are not overridden.

`loadEnv` never overrides variables already present in the process environment.

## Variables

| Variable           | Default                                                           | Purpose                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`     | `<userData>/<app-kebab>.sqlite` (Electron); `<base>/src/storage/<app-kebab>.sqlite` (CLI) | SQLite database location. Relative paths are anchored to the base dir (project root in dev, next to the executable / `APP_BASE_DIR` in a packaged build). |
| `APP_DATA_DIR`     | `<userData>/storage` (Electron); `<base>/src/storage/app` (CLI)   | Redirects the app-managed storage root (private + tmp disks).                                                                                                             |
| `APP_BASE_DIR`     | *(auto)*                                                          | Runtime base dir for relative `DATABASE_URL` / storage paths and where `.env` is loaded from. Useful for installed apps so config + data live outside the install folder. |
| `DESKAPP_UI`       | `true`                                                            | `false` = headless mode at runtime (tray only, no window).                                                                                                                |
| `DESKAPP_CHROMIUM` | *(unset)*                                                         | Overrides the Chromium binary path used by Playwright features.                                                                                                           |
| `API_URL`          | *(unset)*                                                         | Base URL for remote server calls from the main process (`http` on the facade, `app.net.apiFetch`). Read at runtime; a missing scheme is filled in (`localhost:3000` → `http://localhost:3000`, `wallet.example.com` → `https://…`). Empty = fully offline. |
| `VITE_API_URL`     | *(unset)*                                                         | Build-time (renderer): the Pulse socket fallback URL and the optional `/api` dev proxy target. **Not** for server calls from a module.                                     |
| `VITE_SOCKET_URL`  | *(unset)*                                                         | Build-time (renderer): the Pulse socket URL. When set (or `VITE_API_URL`), `__SOCKET_ENABLED__` is on.                                                                     |
| `NODE_ENV`         | *(unset)*                                                         | Set to `development` in dev scripts for hot reload behavior.                                                                                                              |

## Example

```bash
# Fully local (default): no DATABASE_URL is required. The database lives in the
# Electron userData folder as <app-kebab>.sqlite. Set DATABASE_URL only to override:
# DATABASE_URL=sqlite:./data/app.sqlite

# Optional: store app-managed state in a custom dir
# APP_DATA_DIR=%APPDATA%/MyApp

# Optional: base dir for relative paths + where .env is loaded from
# APP_BASE_DIR=%APPDATA%/MyApp

# Optional: remote server API for main-process calls (http / app.net.apiFetch)
# API_URL=https://wallet.example.com
```

::: tip
`.env` is gitignored. `.env.example` ships with the scaffold as the starting point.
:::

## Boolean parsing

`envBool(name, fallback)` treats `1`, `true`, `yes`, `on` (case-insensitive) as on; anything else is off. It backs `DESKAPP_UI` in `src/core/config.ts`.
