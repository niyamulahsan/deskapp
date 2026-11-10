/**
 * config.ts - runtime framework configuration.
 *
 * Reads app identity from src/config/app.ts (edit that file for 0-hassle naming),
 * with safe fallback to package.json.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { appConfig } from "@config/app";

interface PackageJsonConfig {
  name?: string;
  productName?: string;
  build?: {
    productName?: string;
    mac?: { icon?: string };
    win?: { icon?: string };
    linux?: { icon?: string };
  };
}

function getElectronApp(): any {
  try {
    const req = typeof require !== "undefined" ? require : createRequire(process.cwd() + "/");
    const e = req("electron");
    if (e && typeof e === "object" && typeof e.app?.getPath === "function") return e.app;
  } catch {}
  return undefined;
}

/** The project's package.json, read once and cached (fallback / extra build metadata). */
let pkgJsonCache: PackageJsonConfig | null | undefined;
function readPackageJson(): PackageJsonConfig | undefined {
  if (pkgJsonCache !== undefined) return pkgJsonCache;

  const candidates: string[] = [];
  const app = getElectronApp();
  try {
    if (app?.getAppPath) candidates.push(join(app.getAppPath(), "package.json"));
  } catch {}
  try {
    if (app?.isPackaged) candidates.push(join(dirname(app.getPath("exe")), "package.json"));
  } catch {}
  candidates.push(join(process.cwd(), "package.json"));

  // Walk up from cwd to find package.json (CLI/dev safety)
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    candidates.push(join(dir, "package.json"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        pkgJsonCache = JSON.parse(fs.readFileSync(p, "utf-8")) as PackageJsonConfig;
        return pkgJsonCache;
      }
    } catch {}
  }
  pkgJsonCache = null;
  return undefined;
}

/** Parse a boolean env var: "1"/"true"/"yes"/"on" are on, anything else off. */
export function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const uiEnabled = () => envBool("DESKAPP_UI", true);

const APP_NAME_FALLBACK = "Deskapp";
const pkg = readPackageJson();

// Prefer src/config/app.ts (zero-hassle), fall back to package.json.
const appName = appConfig?.productName || pkg?.build?.productName || pkg?.productName || pkg?.name || APP_NAME_FALLBACK;
const appKebab = (appConfig?.name || appName)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const config = {
  /** Display name (src/config/app.ts > package.json, fallback "Deskapp"). */
  appName,
  /** Filesystem-safe kebab form — sqlite filename, linux binary name. */
  appKebab,
  /** Per-OS output paths from package.json build config */
  desktopOutput: pkg?.build ?? null,
  ui: {
    /** True when the frontend should be served and a window opened. */
    enabled: uiEnabled()
  }
};
