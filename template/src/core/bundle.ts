import { basename, dirname, fromFileUrl, join } from "@std/path";

/**
 * bundle.ts - reusable cross-platform build/bundle script for the framework.
 *
 * Builds the desktop app and optionally bundles Chromium for the target OS so
 * the Playwright-based features ("Play" button, etc.) work on end-user
 * machines without a Playwright install.
 *
 * Usage (from project root):
 *   deno task maker bundle:win     # host build (Windows)
 *   deno task maker bundle:mac     # --target x86_64-apple-darwin
 *   deno task maker bundle:linux   # --target x86_64-unknown-linux-gnu
 *
 * Flags:
 *   --chromium=auto   bundle Chromium if found in the Playwright cache (default)
 *   --chromium=force  fail the build if Chromium is missing
 *   --chromium=skip   build without bundling Chromium (no Playwright features)
 *   --ui=auto         build + bundle the frontend if a src/ui source exists (default)
 *   --ui=skip         headless build - no frontend, no window (tray background app)
 *   --ui=force        fail the build if the src/ui source is missing
 *   --target <triple> cross-compile for another OS
 *   --output <path>   override the app output path
 *   --no-zip          skip producing the archive
 */

const ROOT = dirname(dirname(fromFileUrl(new URL(".", import.meta.url))));

interface Flags {
  target?: string;
  chromium: "auto" | "skip" | "force";
  ui: "auto" | "skip" | "force";
  output?: string;
  noZip: boolean;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { chromium: "auto", ui: "auto", noZip: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target") flags.target = argv[++i];
    else if (arg.startsWith("--target=")) flags.target = arg.slice("--target=".length);
    else if (arg.startsWith("--chromium=")) {
      const v = arg.slice("--chromium=".length);
      if (v === "auto" || v === "skip" || v === "force") flags.chromium = v;
    }
    else if (arg.startsWith("--ui=")) {
      const v = arg.slice("--ui=".length);
      if (v === "auto" || v === "skip" || v === "force") flags.ui = v;
    }
    else if (arg === "--output") flags.output = argv[++i];
    else if (arg.startsWith("--output=")) flags.output = arg.slice("--output=".length);
    else if (arg === "--no-zip") flags.noZip = true;
  }
  return flags;
}

function run(program: string, args: string[], label: string, cwd: string = ROOT): { code: number } {
  console.log(`== ${label} ==`);
  const { code } = new Deno.Command(program, { args, cwd, stdout: "inherit", stderr: "inherit" }).outputSync();
  if (code !== 0) {
    console.error(`FAILED: ${label} (exit ${code})`);
    Deno.exit(code);
  }
  return { code };
}

function runDeno(args: string[], label: string): { code: number } {
  return run("deno", args, label);
}

function targetOs(target?: string): "windows" | "darwin" | "linux" {
  if (target?.includes("windows")) return "windows";
  if (target?.includes("apple-darwin")) return "darwin";
  if (target?.includes("linux")) return "linux";
  return Deno.build.os as "windows" | "darwin" | "linux";
}

function outputPathFor(os: "windows" | "darwin" | "linux", target?: string): string {
  if (!target) {
    return join(ROOT, "dist", os === "darwin" ? "Deskapp.app" : os === "windows" ? "Deskapp" : "deskapp");
  }
  if (os === "darwin") return join(ROOT, "dist", "Deskapp.app");
  if (os === "windows") return join(ROOT, "dist", "Deskapp");
  return join(ROOT, "dist", "deskapp");
}

function msPlaywrightRoot(os: "windows" | "darwin" | "linux"): string | undefined {
  if (os === "windows") {
    const local = Deno.env.get("LOCALAPPDATA");
    return local ? join(local, "ms-playwright") : undefined;
  }
  const home = Deno.env.get("HOME");
  if (!home) return undefined;
  if (os === "darwin") return join(home, "Library", "Caches", "ms-playwright");
  return join(home, ".cache", "ms-playwright");
}

function findChromiumCache(os: "windows" | "darwin" | "linux"): string | undefined {
  const root = msPlaywrightRoot(os);
  if (!root) return undefined;
  try {
    let best: { name: string; mtime: number } | undefined;
    for (const entry of Deno.readDirSync(root)) {
      if (!entry.isDirectory || !entry.name.startsWith("chromium-")) continue;
      let mtime = 0;
      try {
        mtime = Deno.statSync(join(root, entry.name)).mtime?.getTime() ?? 0;
      } catch {
        // unreadable entry - ignore
      }
      if (!best || mtime > best.mtime) best = { name: entry.name, mtime };
    }
    if (best) return join(root, best.name);
  } catch {
    return undefined;
  }
  return undefined;
}

function destinationFor(appOut: string, os: "windows" | "darwin" | "linux"): string {
  // Where the runtime resolver looks for Chromium:
  //   windows/linux: <output>/chromium
  //   darwin:        <output>/Contents/MacOS/chromium (next to the launcher)
  if (os === "darwin") return join(appOut, "Contents", "MacOS", "chromium");
  return join(appOut, "chromium");
}

function copyRecursive(src: string, dest: string): void {
  if (Deno.statSync(src).isDirectory) {
    Deno.mkdirSync(dest, { recursive: true });
    for (const entry of Deno.readDirSync(src)) {
      copyRecursive(join(src, entry.name), join(dest, entry.name));
    }
  } else {
    Deno.copyFileSync(src, dest);
  }
}

function extensionDestinationFor(appOut: string, os: "windows" | "darwin" | "linux"): string {
  if (os === "darwin") return join(appOut, "Contents", "MacOS", "extensions");
  return join(appOut, "extensions");
}

function extensionsToBundle(): string[] {
  const root = join(ROOT, "src", "extensions");
  try {
    return [...Deno.readDirSync(root)].filter((e) => e.isDirectory).map((e) => join(root, e.name));
  } catch {
    return [];
  }
}

function copyExtensionsInto(appOut: string, os: "windows" | "darwin" | "linux"): void {
  const dirs = extensionsToBundle();
  if (dirs.length === 0) return;
  const destBase = extensionDestinationFor(appOut, os);
  for (const dir of dirs) {
    const dest = join(destBase, basename(dir));
    try {
      Deno.removeSync(dest, { recursive: true });
    } catch {
      // nothing to remove yet
    }
    copyRecursive(dir, dest);
  }
  console.log(`  extensions: ${dirs.map((d) => basename(d)).join(", ")} -> ${destBase}`);
}

function copyChromiumInto(cache: string, appOut: string, os: "windows" | "darwin" | "linux"): void {
  const dest = destinationFor(appOut, os);
  try {
    Deno.removeSync(dest, { recursive: true });
  } catch {
    // nothing to remove yet
  }
  Deno.mkdirSync(dirname(dest), { recursive: true });
  copyRecursive(cache, dest);
  console.log(`  chromium: ${dest}`);
}

/** The folder deno desktop actually wrote. On darwin it appends `.app` to the
 * `--output` path (e.g. `--output dist/Deskapp.app` -> `dist/Deskapp.app.app`
 * when cross-compiling from another host), so resolve the real directory. */
function resolveAppOut(appOut: string, os: "windows" | "darwin" | "linux"): string {
  const exists = (p: string): boolean => {
    try {
      return Deno.statSync(p).isDirectory;
    } catch {
      return false;
    }
  };
  if (os === "darwin" && !exists(appOut) && exists(`${appOut}.app`)) return `${appOut}.app`;
  return appOut;
}

const flags = parseFlags(Deno.args);
const os = targetOs(flags.target);
const appOut = flags.output ?? outputPathFor(os, flags.target);
const distDir = dirname(appOut);

runDeno(["run", "-A", "src/core/api/generate.manifest.ts"], "1/4 generate bindings manifest");

// UI step: --ui=skip => headless (no frontend built or bundled, no window at
// runtime). auto => build+include when a src/ui source exists. force => require it.
const uiSource = join(ROOT, "src", "ui");
const uiExists = (() => {
  try {
    return Deno.statSync(uiSource).isDirectory;
  } catch {
    return false;
  }
})();

let includeUi = false;
if (flags.ui === "skip") {
  console.log("== 2/4 build UI ==\n  skipped (--ui=skip headless build)");
} else if (!uiExists && flags.ui === "force") {
  console.error("FAILED: --ui=force but no src/ui source found.");
  Deno.exit(1);
} else if (uiExists) {
  run("deno", ["run", "-A", "npm:vite", "build"], "2/4 build UI", join(ROOT, "src", "ui"));
  includeUi = true;
} else {
  console.log("== 2/4 build UI ==\n  no src/ui source found - headless build");
}

console.log("== 3/4 build desktop app ==");
const desktopArgs = ["desktop", "-A", "--output", appOut, "--include=./src/storage", "--include=./src/icons", "src/main.ts"];
if (includeUi) desktopArgs.splice(desktopArgs.length - 1, 0, "--include=./src/ui/dist");
if (flags.target) desktopArgs.push("--target", flags.target);
runDeno(desktopArgs, "deno desktop");
const realAppOut = resolveAppOut(appOut, os);

console.log("== chromium (optional) ==");
let bundled = false;
if (flags.chromium === "skip") {
  console.log("  skipped: Playwright features only work where Chromium is installed.");
} else {
  const cache = findChromiumCache(os);
  if (cache) {
    copyChromiumInto(cache, realAppOut, os);
    copyExtensionsInto(realAppOut, os);
    bundled = true;
  } else if (flags.chromium === "force") {
    console.error("  FAILED: --chromium=force but no Playwright Chromium found. Install: npx playwright install chromium");
    Deno.exit(1);
  } else {
    console.log("  no Playwright Chromium found in cache - skipped (Playwright features limited).");
  }
}

if (!flags.noZip) {
  const zip = join(distDir, `${basename(appOut)}.zip`);
  try {
    Deno.removeSync(zip);
  } catch {
    // no stale zip yet
  }
  console.log(`== archive -> ${zip} ==`);
  if (os === "windows") {
    run(
      "powershell",
      ["-NoProfile", "-Command", `Compress-Archive -Force -Path '${realAppOut}' -DestinationPath '${zip}'`],
      "compress",
    );
  } else {
    const t = new Deno.Command("tar", {
      args: ["-czf", zip, "-C", distDir, basename(realAppOut)],
      cwd: ROOT,
      stdout: "inherit",
      stderr: "inherit",
    });
    const r = t.outputSync();
    if (r.code !== 0) console.log("  (tar unavailable; app folder shipped as-is)");
  }
}

console.log("== READY ==");
console.log(`  app folder: ${realAppOut}`);
console.log(`  ui:         ${flags.ui === "skip" ? "none (skipped - headless)" : includeUi ? "bundled" : "none (no src/ui source)"}`);
console.log(`  chromium:   ${flags.chromium === "skip" ? "none (skipped)" : bundled ? "bundled" : "not found"}`);