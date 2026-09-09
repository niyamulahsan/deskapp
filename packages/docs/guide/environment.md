# Environment

Configuration comes from environment variables in `.env` (loaded automatically by `deno task dev` / `serve` via `--env-file`). Copy `.env.example` to `.env` — the scaffold script does this for you.

## Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:./src/storage/deskapp.sqlite` | SQLite database location. |
| `APP_DATA_DIR` | `./src/storage/app` | Redirects the app-managed storage root (private + tmp disks). Point a packaged build at the OS user-data dir if you want state outside the install folder. |
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
```

::: tip
`.env` is gitignored. `.env.example` ships with the scaffold as the starting point.
:::

## Boolean parsing

`envBool(name, fallback)` treats `1`, `true`, `yes`, `on` (case-insensitive) as on; anything else is off. It backs `DESKAPP_UI` in `src/core/config.ts`.