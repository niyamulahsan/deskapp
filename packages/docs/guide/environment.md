# Environment

Configuration comes from environment variables in `.env`. Copy `.env.example` to `.env` — the scaffold script does this for you.

- **Development** (`deno task dev` / `serve`): the maker runs the app with `--env-file`, so `.env` at the project root is applied before `main.ts` starts.
- **Packaged builds**: the compiled binary has no `--env-file`. At startup `src/core/env.ts` (`loadEnv`) finds a `.env` **next to the executable** (or in `APP_BASE_DIR`) and loads it — so the same `DATABASE_URL` keeps working after bundling, no rebuild required.

`loadEnv` never overrides variables already present in the process environment.

## Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:<base>/src/storage/<project-name>.sqlite` | SQLite database location. Relative paths are anchored to the base dir (project root in dev, next to the executable / `APP_BASE_DIR` in a bundle), never to `Deno.cwd()`. |
| `APP_DATA_DIR` | `<base>/src/storage/app` | Redirects the app-managed storage root (private + tmp disks). Point a packaged build at the OS user-data dir if you want state outside the install folder. |
| `APP_BASE_DIR` | *(auto)* | Runtime base dir for relative `DATABASE_URL` / storage paths and the folder `.env` is loaded from. Useful for installed apps: set it to e.g. `%APPDATA%/MyApp` so config + data live outside the read-only install folder. |
| `DESKAPP_UI` | `true` | `false` = headless mode at runtime (server-only + tray, no window). |
| `DESKAPP_CHROMIUM` | *(unset)* | Overrides the Chromium binary path used by Playwright features. |
| `FRONTEND_WATCH` | *(unset)* | Set to `1` by `deno task dev`. Makes the backend watch `src/ui/dist` and reload the open window when the UI rebuilds (`win.watchFrontend`). |
| `DENO_SERVE_ADDRESS` | *(set by Deno)* | Port the backend serves UI on; windows navigate to `http://127.0.0.1:<port><route>`. |

## Example

```bash
# Fully local (default)
DATABASE_URL=sqlite:./src/storage/deskapp.sqlite

# Optional: store app-managed state in the OS user-data dir
# APP_DATA_DIR=%APPDATA%/MyApp

# Optional: base dir for relative paths + where .env is loaded from
# APP_BASE_DIR=%APPDATA%/MyApp
```

::: tip
`.env` is gitignored. `.env.example` ships with the scaffold as the starting point, and `deno task maker bundle:*` copies it next to the built executable so you can drop a real `.env` beside the app on end-user machines.
:::

## Boolean parsing

`envBool(name, fallback)` treats `1`, `true`, `yes`, `on` (case-insensitive) as on; anything else is off. It backs `DESKAPP_UI` in `src/core/config.ts`.