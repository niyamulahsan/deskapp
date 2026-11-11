# Configuration

Most configuration lives in `package.json`; window presets live in `src/window/config.ts`.

## App Identity

Configure your app in `src/config/app.ts`. Update the fields there, then run:

```sh
npm run config:sync
```

This syncs the values to `package.json` and build configuration (appId, product name, protocol, etc.).

## package.json

The scaffolded app uses `package.json` for scripts, dependencies, and [electron-builder](https://www.electron.build/) configuration. See the template's `package.json` for the full structure.

Key parts:
- **Scripts**: `dev`, `build`, `package`, `maker`, etc.
- **Dependencies**: Electron, Vue, Vite, Drizzle ORM, etc.
- **build** section: electron-builder config for packaging per OS.

## Scripts

| Script           | Runs                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `dev`            | Runs UI dev server, builds main/preload in watch mode, and launches Electron. |
| `dev:ui`         | Vite dev server for the renderer.                                             |
| `dev:main`       | esbuild watch for main and preload.                                           |
| `dev:electron`   | Waits for UI dev server and launches Electron.                                |
| `build`          | Builds UI and Electron main/preload.                                          |
| `build:ui`       | Builds the Vue app with Vite.                                                 |
| `build:electron` | Builds main and preload with esbuild.                                         |
| `start`          | Runs the built app with Electron.                                             |
| `package`        | Builds and packages with electron-builder (outputs to `release/`).            |
| `maker`          | Runs the maker CLI.                                                           |

## Windows (`src/window/config.ts`)

Only presets declared in the `windows` map open at boot — the default template ships just `main`. You can open additional windows on demand with `win.openWindow()`.

```ts
export interface WindowPreset {
  title: string;
  width: number;
  height: number;
  x?: number;                    // centered if omitted
  y?: number;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  frameless?: boolean;
  noActivate?: boolean;
  transparentTitlebar?: boolean;
  route?: string;                // route to load in the renderer
  chrome?: boolean;              // install default menu/context-menu/tray; false skips it
}

export const windows: Record<string, WindowPreset> = {
  main: { title: "Deskapp", width: 1280, height: 800, resizable: true, route: "/" },
};
```

```ts
import { win } from "@/core/facade";

// Open an additional window
await win.openWindow({ title: "Settings", width: 420, height: 320, route: "/settings" });
```

Each window is independent. Set `chrome: false` on the `main` preset to start without the default app menu, context menu and tray.
