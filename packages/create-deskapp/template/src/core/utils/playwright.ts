import { dirname, join } from "@std/path";

/**
 * playwright.ts - shared Chromium resolution for the desktop app.
 *
 * Reusable across any controller/feature that needs to launch Chromium
 * (`app.playwright.play`, future screenshot/scrape/kiosk features).
 *
 * Binary resolution order:
 *   1. `DESKAPP_CHROMIUM` env var
 *   2. `<exe dir>/chromium/<platform>/...`  (bundled by src/core/bundle.ts)
 *   3. `<cwd>/chromium/<platform>/...`
 *   4. Playwright's registry installer cache (development only)
 */

export const chromium = {
  /** Whether a path exists on disk. */
  exists(path: string): boolean {
    return existsPath(path);
  },

  /** All candidate Chromium binaries, in resolution order. */
  candidates(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string[] {
    return chromiumCandidates(overrides);
  },

  /** The first candidate that actually exists, or undefined. */
  resolve(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string | undefined {
    return resolveChromium(overrides);
  },

  /** Bundled extension directories next to Chromium. */
  extensions(overrides?: { execPath?: string; cwd?: string; }): string[] {
    return extensionsCandidates(overrides);
  },
};

export function existsPath(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Platform-relative paths inside a bundled `chromium/` folder. */
export function platformRelPaths(): string[][] {
  if (Deno.build.os === "windows") {
    return [["chrome-win64", "chrome.exe"], ["chrome-win", "chrome.exe"]];
  }
  if (Deno.build.os === "linux") {
    return [["chrome-linux", "chrome"]];
  }
  if (Deno.build.os === "darwin") {
    const app = ["Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"];
    return [["chrome-mac-arm64", ...app], ["chrome-mac", ...app]];
  }
  return [];
}

export function chromiumCandidates(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string[] {
  const out: string[] = [];
  const env = overrides?.env === undefined ? Deno.env.get("DESKAPP_CHROMIUM") : overrides.env;
  if (env) out.push(env);

  const bases = [dirname(overrides?.execPath ?? Deno.execPath()), overrides?.cwd ?? Deno.cwd()];
  for (const base of bases) {
    for (const rel of platformRelPaths()) {
      out.push(join(base, "chromium", ...rel));
    }
  }
  return out;
}

export function resolveChromium(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string | undefined {
  return chromiumCandidates(overrides).find(existsPath);
}

/**
 * Extension directories bundled beside Chromium. Developers drop each unpacked
 * extension as its own folder: `src/extensions/<extension-name>/` (a folder
 * with a manifest.json inside); bundling copies those into the app. Same bases
 * as chromium so bundling and resolution always match: dev finds
 * `<cwd>/src/extensions`, a bundled app finds `<exe dir>/extensions` (or
 * `Contents/MacOS/extensions` on macOS).
 */
export function extensionsCandidates(
  overrides?: { execPath?: string; cwd?: string; },
): string[] {
  const out: string[] = [];
  const bases = [dirname(overrides?.execPath ?? Deno.execPath()), overrides?.cwd ?? Deno.cwd()];
  for (const base of bases) {
    for (const rel of ["extensions", join("src", "extensions")]) {
      const root = join(base, rel);
      try {
        for (const entry of Deno.readDirSync(root)) {
          if (!entry.isDirectory) continue;
          const full = join(root, entry.name);
          if (!out.includes(full)) out.push(full);
        }
      } catch {
        // no extensions folder at this base - skip
      }
    }
  }
  return out;
}

export function resolveExtensions(
  overrides?: { execPath?: string; cwd?: string; },
): string[] {
  return extensionsCandidates(overrides);
}