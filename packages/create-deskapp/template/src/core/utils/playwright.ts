import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import { app } from "electron";

function getRequire(): NodeRequire {
  // CJS bundles/runtime have `require`; ESM can derive it when needed.
  if (typeof require !== "undefined") return require as unknown as NodeRequire;
  // Fallback for ESM contexts (not used in the CJS bundle).
  const url = typeof __filename !== "undefined" ? __filename : process.cwd();
  return createRequire(url);
}

export const chromium = {
  exists(path: string): boolean {
    return existsPath(path);
  },
  candidates(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string[] {
    return chromiumCandidates(overrides);
  },
  resolve(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string | undefined {
    return resolveChromium(overrides);
  },
  extensions(overrides?: { execPath?: string; cwd?: string; }): string[] {
    return extensionsCandidates(overrides);
  },
};

export function existsPath(path: string): boolean {
  try {
    fs.statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function platformRelPaths(): string[][] {
  if (process.platform === "win32") {
    return [["chrome-win64", "chrome.exe"], ["chrome-win", "chrome.exe"]];
  }
  if (process.platform === "linux") {
    return [["chrome-linux", "chrome"]];
  }
  if (process.platform === "darwin") {
    const app = ["Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"];
    return [["chrome-mac-arm64", ...app], ["chrome-mac", ...app]];
  }
  return [];
}

export function chromiumCandidates(overrides?: { env?: string | null; execPath?: string; cwd?: string; }): string[] {
  const out: string[] = [];
  const env = overrides?.env === undefined ? process.env.DESKAPP_CHROMIUM : overrides.env;
  if (env) out.push(env);

  const bases = [
    dirname(overrides?.execPath ?? app.getPath("exe")), 
    overrides?.cwd ?? process.cwd()
  ];
  
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

export function extensionsCandidates(overrides?: { execPath?: string; cwd?: string; }): string[] {
  const out: string[] = [];
  const bases = [
    dirname(overrides?.execPath ?? app.getPath("exe")), 
    overrides?.cwd ?? process.cwd()
  ];
  
  for (const base of bases) {
    for (const rel of ["extensions", join("src", "extensions")]) {
      const root = join(base, rel);
      try {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
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

export function resolveExtensions(overrides?: { execPath?: string; cwd?: string; }): string[] {
  return extensionsCandidates(overrides);
}

export async function ensurePlaywrightBrowser(browser = "chromium"): Promise<void> {
  try {
    // In Node, resolve playwright's CLI if installed.
    const req = getRequire();
    const playwrightPkg = req.resolve("playwright/package.json");
    const cliFile = join(dirname(playwrightPkg), "cli.js");
    
    if (!existsPath(cliFile)) {
      throw new Error(`playwright CLI not found at ${cliFile}; install the browser manually with 'npx playwright install ${browser}'.`);
    }
    
    // In Electron, process.execPath is the Electron binary, not Node.
    // We use the system's Node execution to run the playwright CLI.
    execSync(`node "${cliFile}" install ${browser}`, { stdio: "inherit" });
  } catch (error) {
    console.error("[playwright] Failed to ensure browser:", error);
    throw new Error(`playwright install ${browser} failed; retry with 'npx playwright install ${browser}'.`);
  }
}