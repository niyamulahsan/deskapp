# Build & Package

In the Electron-based setup, use npm scripts and electron-builder for building and packaging.

## App Identity (package name)

Configure your app identity in `src/config/app.ts`. This file controls the app name, product name, appId, protocol scheme, and more. After changing it, sync to `package.json` and installer config:

```sh
npm run config:sync
```

This also runs automatically as part of `npm run package`. The sync updates `package.json` (name/description) and related build configuration so your packaged app uses the correct identity.

## Commands

| Command                  | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `npm run build`          | Build UI and Electron main/preload.                             |
| `npm run build:ui`       | Build the Vue UI with Vite.                                     |
| `npm run build:electron` | Build main and preload with esbuild.                            |
| `npm run package`        | Build and package with electron-builder. Outputs to `release/`. |

```sh
npm run build
npm run package
```

## Configuration

Packaging is configured in `package.json` under the `build` section (appId, productName, icons, targets for Windows/macOS/Linux).

## Output

Packaged applications are written to the `release/` directory by default.
