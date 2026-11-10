/**
 * env.ts - runtime environment bootstrapping.
 *
 * Migrated from Deno to Node.js/Electron.
 * Uses `dotenv` to load `.env` files from stable locations.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

function getElectronApp(): any {
  try {
    const req = typeof require !== "undefined" ? require : createRequire(process.cwd() + "/");
    const e = req("electron");
    if (e && typeof e === "object" && typeof e.app?.getPath === "function") return e.app;
  } catch {}
  return undefined;
}

/** True when running inside the Electron runtime. */
export function isDesktopRuntime(): boolean {
  return !!getElectronApp();
}

/** True only for a real packaged app. */
function bundledDesktopApp(): boolean {
  const app = getElectronApp();
  return !!app?.isPackaged;
}

function findProjectRoot(start: string): string | undefined {
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    try {
      if (fs.statSync(join(dir, "package.json")).isFile()) return dir;
    } catch {}
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** The app/project root in development, executable/resources dir when packaged. */
export function appBaseDir(): string {
  const override = process.env.APP_BASE_DIR?.trim();
  if (override) return resolve(override);

  const electronApp = getElectronApp();
  if (electronApp?.isPackaged) {
    return dirname(electronApp.getPath("exe"));
  }

  // Dev: prefer cwd (npm scripts run from project root), then locate package.json.
  const cwd = resolve(process.cwd());
  if (fs.existsSync(join(cwd, "package.json"))) return cwd;

  try {
    if (electronApp) {
      const found = findProjectRoot(electronApp.getAppPath());
      if (found) return found;
    }
  } catch {}

  return cwd;
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

  const electronApp = getElectronApp();
  const base = appBaseDir();
  const candidates = [
    process.env.APP_BASE_DIR?.trim(),
    electronApp?.isPackaged ? dirname(electronApp.getPath("exe")) : undefined,
    base,
    electronApp?.getAppPath ? electronApp.getAppPath() : undefined,
    resolve(process.cwd())
  ].filter((dir): dir is string => Boolean(dir) && dir.length > 0);

  for (const dir of [...new Set(candidates)]) {
    const envPath = join(dir, ".env");
    try {
      if (!fs.statSync(envPath).isFile()) continue;
      loadDotenv({ path: envPath });
      envState.path = envPath;
      return envPath;
    } catch {}
  }
  return null;
}

/** The runtime `.env` path that was loaded (null until loadEnv runs / none). */
export function envPath(): string | null {
  return envState.tried ? envState.path : null;
}
