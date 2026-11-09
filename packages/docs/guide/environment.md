# Environment

Configuration comes from environment variables in `.env`. Copy `.env.example` to `.env`.

- **Development**: load with your app (e.g. `npm run dev`). The app uses `dotenv` and `loadEnv()` to find `.env` from the project root or cwd.
- **Packaged builds**: `loadEnv()` in `src/core/env.ts` searches for `.env` next to the executable, in `APP_BASE_DIR`, or common locations. Variables already present in the environment are not overridden.

`loadEnv` never overrides variables already present in the process environment.

## Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:./src/storage/something-else.sqlite` (see `.env.example`) | SQLite database location. Relative paths are anchored to the base dir (project root in dev, next to the executable / `APP_BASE_DIR` in a packaged build). |
| `APP_DATA_DIR` | `<base>/src/storage/app` | Redirects the app-managed storage root (private + tmp disks). |
| `APP_BASE_DIR` | *(auto)* | Runtime base dir for relative `DATABASE_URL` / storage paths and where `.env` is loaded from. Useful for installed apps so config + data live outside the install folder. |
| `DESKAPP_UI` | `true` | `false` = headless mode at runtime (tray only, no window). |
| `DESKAPP_CHROMIUM` | *(unset)* | Overrides the Chromium binary path used by Playwright features. |
| `NODE_ENV` | *(unset)* | Set to `development` in dev scripts for hot reload behavior. |

## Example

```bash
# Fully local (default)
DATABASE_URL=sqlite:./src/storage/something-else.sqlite

# Optional: store app-managed state in the OS user-data dir
# APP_DATA_DIR=%APPDATA%/MyApp

# Optional: base dir for relative paths + where .env is loaded from
# APP_BASE_DIR=%APPDATA%/MyApp
```

::: tip
`.env` is gitignored. `.env.example` ships with the scaffold as the starting point.
:::

## Boolean parsing

`envBool(name, fallback)` treats `1`, `true`, `yes`, `on` (case-insensitive) as on; anything else is off. It backs `DESKAPP_UI` in `src/core/config.ts`.
