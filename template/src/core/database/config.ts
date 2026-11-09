import { isAbsolute, join } from "node:path";
import { config } from "@/core/config";
import { appBaseDir } from "@/core/env";

function getElectronApp(): { getPath: (name: string) => string; isPackaged: boolean } | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const e = require("electron") as any;
    if (e && typeof e.app?.getPath === "function") return e.app;
  } catch {}
  return undefined;
}

function getAppBaseDir(): string {
  try {
    return appBaseDir();
  } catch {
    return process.cwd();
  }
}

/** The URI (scheme + path) for the local SQLite file. */
export function resolveDatabaseUrl(): string {
  const raw = (process.env.DATABASE_URL ?? "").trim();

  // Default: Store in the OS-specific user data folder when running in Electron.
  if (!raw) {
    const electronApp = getElectronApp();
    if (electronApp) {
      return `sqlite:${join(electronApp.getPath("userData"), `${config.appKebab}.sqlite`)}`;
    }
    // CLI / non-Electron fallback
    return `sqlite:${join(getAppBaseDir(), "src", "storage", `${config.appKebab}.sqlite`)}`;
  }

  // In-memory databases and remote libsql URLs are used as-is.
  if (raw.includes(":memory:")) return raw;
  if (raw.includes("://")) return raw;

  const body = raw.replace(/^(sqlite|file):/, "");
  const anchored = body && !isAbsolute(body) ? join(getAppBaseDir(), body) : body;
  return `${raw.startsWith("file:") ? "file" : "sqlite"}:${anchored}`;
}

/** The local SQLite file path (strips the `sqlite:`/`file:` scheme). */
export function sqliteFile(): string {
  return resolveDatabaseUrl().replace(/^(sqlite|file):/, "");
}
