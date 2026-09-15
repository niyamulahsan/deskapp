/**
 * config.ts - runtime framework configuration.
 *
 * Identity comes from the project's own deno.json (desktop.app.name +
 * desktop.output), so a scaffold carries the name you chose at create time
 * through window titles, tray tooltips, bundle outputs, and the default
 * database file. Feature flags are read from the environment with sensible
 * defaults; app code imports this fresh (or through the facade) instead of
 * scattering Deno.env reads.
 *
 * Flags:
 *   DESKAPP_UI=(true|false)  serve/ship the frontend + open windows.
 *                            false = headless: server-only + tray, no window.
 */

import { dirname, fromFileUrl, join } from "@std/path";
import { isDesktopRuntime } from "@/core/env.ts";

interface DenoJsonDesktopOutput {
  macos?: string;
  windows?: string;
  linux?: string;
}

interface DenoJsonConfig {
  desktop?: {
    app?: { name?: string };
    output?: DenoJsonDesktopOutput;
  };
}

/** The project's deno.json, read once and cached. In a packaged app the file
 * is copied next to the executable (bundle.ts), so fall back to it. */
let denoJsonCache: DenoJsonConfig | null | undefined;
function readDenoJson(): DenoJsonConfig | undefined {
  if (denoJsonCache !== undefined) return denoJsonCache;
  const candidates = [fromFileUrl(new URL("../../deno.json", import.meta.url))];
  if (isDesktopRuntime()) candidates.push(join(dirname(Deno.execPath()), "deno.json"));
  for (const path of candidates) {
    try {
      denoJsonCache = JSON.parse(Deno.readTextFileSync(path)) as DenoJsonConfig;
      return denoJsonCache;
    } catch {
      // try the next candidate
      continue;
    }
  }
  denoJsonCache = null;
  return undefined;
}

/** Parse a boolean env var: "1"/"true"/"yes"/"on" are on, anything else off. */
export function envBool(name: string, fallback: boolean): boolean {
  const value = Deno.env.get(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

const uiEnabled = () => envBool("DESKAPP_UI", true);

const APP_NAME_FALLBACK = "Deskapp";
const appName = readDenoJson()?.desktop?.app?.name?.trim() || APP_NAME_FALLBACK;
const appKebab = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const config = {
  /** Display name (deno.json > desktop.app.name, fallback "Deskapp"). */
  appName,
  /** Filesystem-safe kebab form — sqlite filename, linux binary name. */
  appKebab,
  /** Per-OS output paths from deno.json > desktop.output (bundle output). */
  desktopOutput: readDenoJson()?.desktop?.output ?? null,
  ui: {
    /** True when the frontend should be served and a window opened. */
    enabled: uiEnabled(),
  },
};