# Bundle & Build

Deskapp's build/bundle commands live on the maker CLI, driven by `src/core/bundle.ts` (which sits on `deno desktop` / Deno's compile capabilities). Two stages:

1. **`build`** — compile the desktop app the way you run it in dev.
2. **`bundle`** — package it for distribution: UI, optional Chromium (Playwright), extensions, icons, and a `.zip`.

Run every command as `deno task maker <command>`, and pass flags after a `--` separator.

## Commands

| Command | What you get |
| --- | --- |
| `build` | raw `deno desktop` build into `dist/` for the host OS |
| `build:win` / `build:mac` / `build:linux` | same, cross-compiled via `--target <triple>` |
| `bundle` | full distributable for the **host OS** (UI + deps + optional Chromium + zip) |
| `bundle:win` / `bundle:mac` / `bundle:linux` | full distributable for that **specific OS** |

A `bundle` run does everything automatically: regenerate the bindings manifest → build the UI (`src/ui/dist`) → `deno desktop` → copy Chromium/extensions when asked → zip into `dist/`.

## Build first, then pick your target

During development you use `build` / `build:win` / `build:mac` / `build:linux` (or `dev`), which write a raw app folder to `dist/`:

```sh
deno task maker build              # host OS
deno task maker build:mac          # cross-compile for macOS
```

When the app builds cleanly, bundle it for distribution.

### Bundle for one OS

```sh
deno task maker bundle:win         # Windows folder app → dist/Deskapp.zip
deno task maker bundle:mac         # macOS .app → dist/Deskapp.app
deno task maker bundle:linux       # Linux folder app → dist/deskapp
```

### Bundle for all three OSes

Run **each on that OS** (its own machine, VM, or CI job):

```sh
deno task maker bundle:win         # on a Windows machine
deno task maker bundle:mac         # on a macOS machine
deno task maker bundle:linux       # on a Linux machine
```

> [!IMPORTANT] Chromium is OS-specific
> The app binary *cross-compiles*, but Chromium does **not**: it is copied from the **build machine's** Playwright cache, and Chromium binaries are different per OS (each OS has its own Playwright cache location). So to ship a bundle with Chromium, run that OS's bundle on that OS — a `bundle:mac` run on Windows would package a Windows-only app with no macOS Chromium to copy.

## With or without the UI

| `--ui` | Meaning |
| --- | --- |
| `auto` (default) | bundle the frontend if a `src/ui` source exists |
| `skip` | headless build — no frontend, no window (tray/server-only app) |
| `force` | **fail the build** if the `src/ui` source is missing |

```sh
deno task maker bundle:win                    # normal desktop app, UI included
deno task maker bundle:win --ui=skip       # server-only: no UI, no window
```

## With or without Chromium (Playwright)

The **Play button** and Playwright helper features need a real Chromium binary next to the app. Bundle it from the Playwright cache so users get those features out of the box:

| `--chromium` | Meaning |
| --- | --- |
| `auto` (default) | bundle Chromium **if** it is found in the Playwright cache (otherwise build without it) |
| `force` | bundle Chromium and **fail the build** if it isn't in the cache |
| `skip` | build without bundling Chromium (Playwright features only work where a Chromium is installed) |

Install Chromium once per OS, using the version your app actually installs: the app opts into Playwright by adding `"playwright"` to `deno.json` imports (see [Playwright & Chromium](../guide/playwright)), `deno install` puts it in `node_modules`, and `npx playwright install chromium` uses that exact version. `--chromium=force` then guards against a missing cache:

```sh
npx playwright install chromium                  # once, per OS machine (uses the project's installed playwright)
deno task maker bundle:win --chromium=force               # always ships Chromium
deno task maker bundle:linux --chromium=force --no-zip
#   --chromium=force FAILS the build if no matching Playwright Chromium is cached
```

> Don't run `deno run -A npm:playwright install chromium` instead — that bare specifier can resolve to a *different* cached version and download a browser build the bundle can't find (the registry path for the wrong build won't match). If you must use the `deno run` form, pin the exact version `deno install` resolved, e.g. `deno run -A npm:playwright@1.63.0 install chromium`.

Any `src/extensions/*` folders are copied next to Chromium automatically (`chromium/` / `extensions/` beside the launcher).

## Flags

| Flag | Values | Meaning |
| --- | --- | --- |
| `--ui` | `auto` (default) / `skip` / `force` | bundle the frontend, or skip/require it (headless server-only build) |
| `--chromium` | `auto` (default) / `skip` / `force` | bundle Chromium from the Playwright cache, or skip/require it |
| `--target` | `<rust-triple>` | cross-compile target, e.g. `x86_64-pc-windows-msvc`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`. Host OS when omitted; `bundle:mac` / `bundle:linux` pass it automatically. |
| `--output` | path | override the app output path (defaults to `dist/Deskapp` / `dist/Deskapp.app` / `dist/deskapp`) |
| `--no-zip` | boolean | skip producing the `.zip` archive |

```sh
deno task maker bundle:win --no-zip                 # folder only, no zip
deno task maker bundle:linux --ui=skip --chromium=skip
```

## What gets bundled

- The compiled backend (`src/main.ts` entry, UI + storage + icons included via `deno desktop --include`) with its import map bundled in
- `src/ui/dist` (the built frontend), served from the binary's virtual filesystem
- Optional Chromium (from the Playwright cache) and, when present, `src/extensions/*` copied next to it
- An icon set from `src/icons/`
- Output into `dist/Deskapp` / `dist/Deskapp.app` / `dist/deskapp`
- A `.zip` archive unless `--no-zip`

Every bundle run first regenerates the bindings manifest (`deno task maker bindings:gen`).

## Deep links & app identity

Identity comes from `deno.json` → `desktop.app`:

```json
"desktop": { "app": { "name": "Deskapp", "deepLinks": ["deskapp"] } }
```

`deepLinks` registers the scheme (e.g. `deskapp://`) for OS-level launch-by-URL. Change both for your own product.

## Distribution caveats

- Bundles are single-arch; distribute per-OS artifacts (`dist/Deskapp.zip`, `dist/Deskapp.app`).
- SQLite is embedded (`node:sqlite`) in packaged builds — no libsql binary shipped.
- Keep `src/storage/` (DB, app-managed files) out of the bundle; point `APP_DATA_DIR` at the OS user-data folder for packaged builds so state survives updates.