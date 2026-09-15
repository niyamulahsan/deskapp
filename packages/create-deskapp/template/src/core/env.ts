/**
 * env.ts - runtime environment bootstrapping.
 *
 * Development (`deno task dev` / `serve`) loads `.env` through the maker's
 * `--env-file` flag before main.ts even starts. A packaged build runs the
 * compiled binary with no such flag, so the framework loads `.env` itself
 * from a stable location so `DATABASE_URL`/`APP_*` behave identically after
 * bundling.
 *
 * Runtime topology (Deno 2.9 `deno desktop`, engine "laufey"):
 *   - dev (`deno desktop --hmr` spawned by the maker from the repo root):
 *     Deno.cwd() is the REAL project root, but `Deno.execPath()` is the
 *     laufey webview runtime under %LOCALAPPDATA% and import.meta points at a
 *     temp mount. Base must be Deno.cwd().
 *   - bundled app: the executable sits next to the shipped project folder,
 *     which always includes `deno.json` (bundle.ts passes `--include` +
 *     `--include=./src/storage`). Base is the executable's directory.
 *
 * Base directory resolution order:
 *   1. `APP_BASE_DIR` - explicit override (e.g. an OS user-data path).
 *   2. bundled desktop app - the executable's own directory.
 *   3. development - the project root (Deno.cwd(), or import.meta in a plain
 *      `deno run`).
 *
 * Relative `DATABASE_URL` / storage paths are anchored to this base, so a
 * `.env` written for dev (`sqlite:./src/storage/...`) works unchanged next
 * to a packaged executable.
 */

import { loadSync } from "@std/dotenv";
import { basename, dirname, fromFileUrl, join, resolve } from "@std/path";

/** True when running inside the Deno desktop runtime (bundled OR `deno desktop`). */
export function isDesktopRuntime(): boolean {
  try {
    const desktop = (Deno as typeof Deno & {
      BrowserWindow?: () => unknown;
    }).BrowserWindow;
    return typeof desktop === "function";
  } catch {
    return false;
  }
}

/** True only for a real packaged app: `deno desktop` writes a `.deno-desktop-app`
 * marker into the app folder next to the executable. In dev the app runs from
 * the laufey runtime dir, which has no such marker (even though a stray
 * `src/storage` may exist there from earlier broken runs). */
function bundledDesktopApp(): boolean {
  if (!isDesktopRuntime()) return false;
  try {
    if (basename(Deno.execPath()) === "laufey_webview.exe") return false;
    const s = Deno.statSync(join(dirname(Deno.execPath()), ".deno-desktop-app"));
    return s.isFile || s.isDirectory;
  } catch {
    return false;
  }
}

/** The executable dir in a packaged build, the project root in development. */
export function appBaseDir(): string {
  const override = Deno.env.get("APP_BASE_DIR")?.trim();
  if (override) return resolve(override);
  if (isDesktopRuntime()) {
    if (bundledDesktopApp()) return dirname(Deno.execPath());
    return resolve(Deno.cwd());
  }
  return resolve(fromFileUrl(new URL("../../", import.meta.url)));
}

const envState: { path: string | null; tried: boolean } = { path: null, tried: false };

/**
 * Load the first `.env` found next to the app (bundled) or at the project
 * root (dev); never overrides variables already present in the environment.
 * Returns the resolved path, or null when no `.env` exists. Idempotent.
 */
export function loadEnv(): string | null {
  if (envState.tried) return envState.path;
  envState.tried = true;

  const candidates = [
    Deno.env.get("APP_BASE_DIR")?.trim(),
    bundledDesktopApp() ? dirname(Deno.execPath()) : undefined,
    resolve(Deno.cwd()),
    resolve(fromFileUrl(new URL("../../", import.meta.url))),
  ].filter((dir): dir is string => Boolean(dir) && dir.length > 0);

  for (const dir of [...new Set(candidates)]) {
    const envPath = join(dir, ".env");
    try {
      if (!Deno.statSync(envPath).isFile) continue;
      // export: true writes parsed vars into Deno.env (loadSync alone just
      // returns them); never overrides vars already present in the env.
      loadSync({ envPath, export: true });
      envState.path = envPath;
      return envPath;
    } catch {
      // unreadable .env - try the next candidate
      continue;
    }
  }
  return null;
}

/** The runtime `.env` path that was loaded (null until loadEnv runs / none). */
export function envPath(): string | null {
  return envState.tried ? envState.path : null;
}