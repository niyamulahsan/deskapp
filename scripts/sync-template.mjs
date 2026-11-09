#!/usr/bin/env node

import { cpSync, rmSync, renameSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "template");
const DEST = join(ROOT, "packages", "create-deskapp", "template");

/**
 * Env values pinned on every synced env file.
 */
const FORCED_ENV_DEFAULTS = {
  DESKAPP_UI: "true",
};

/** Parse the uncommented KEY=VALUE pairs of an env file. */
function parseEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

/**
 * Pin FORCED_ENV_DEFAULTS in an env file, keeping its existing line endings.
 */
function pinEnvDefaults(text, label) {
  const pinned = [];
  let out = text;
  for (const [key, value] of Object.entries(FORCED_ENV_DEFAULTS)) {
    const pattern = new RegExp(`^${key}\\s*=.*?(\\r?)$`, "m");
    const match = pattern.exec(out);
    if (!match) {
      pinned.push(`${key} (added as ${value})`);
      out = `${key}=${value}\n${out}`;
      continue;
    }
    if (match[0].trim() !== `${key}=${value}`) pinned.push(`${key}=${value}`);
    out = out.replace(pattern, `${key}=${value}$1`);
  }
  if (pinned.length) console.log(`  [${label}] pinned ${pinned.join(", ")}`);
  return out;
}

/**
 * Report keys where the synced .env disagrees with the tracked .env.example.
 */
function reportEnvDrift(examplePath, envPath, name) {
  if (!existsSync(examplePath) || !existsSync(envPath)) return;
  const example = parseEnv(readFileSync(examplePath, "utf8"));
  const actual = parseEnv(readFileSync(envPath, "utf8"));
  const drifted = [...example.keys()].filter((key) => actual.has(key) && actual.get(key) !== example.get(key));
  const onlyLocal = [...actual.keys()].filter((key) => !example.has(key));
  if (!drifted.length && !onlyLocal.length) return;
  const parts = [
    ...drifted.map((key) => `${key}: ${example.get(key)} -> ${actual.get(key)}`),
    ...onlyLocal.map((key) => `${key} (not in .env.example)`),
  ];
  console.log(`  [${name}] .env differs from .env.example — this ships: ${parts.join("; ")}`);
}

/**
 * Normalize the synced scaffold to a fresh-checkout state.
 */
function sanitizeScaffold(dest, name) {
  const resetToGitkeep = (dir, label, extraFiles = []) => {
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        if (entry === ".gitkeep" || extraFiles.includes(entry)) continue;
        rmSync(join(dir, entry), { recursive: true, force: true });
      }
    } else {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(join(dir, ".gitkeep"))) writeFileSync(join(dir, ".gitkeep"), "");
    for (const entry of extraFiles) {
      writeFileSync(join(dir, entry), "");
    }
    const allowed = new Set([".gitkeep", ...extraFiles]);
    if (readdirSync(dir).some((entry) => !allowed.has(entry))) {
      console.error(`  [${name}] ${label} still contains build output - refusing to publish it`);
      process.exit(1);
    }
  };

  resetToGitkeep(join(dest, "src", "storage", "logs"), "src/storage/logs/", ["app.log", "fatal.log"]);
  if (existsSync(join(dest, "src", "ui", "dist"))) rmSync(join(dest, "src", "ui", "dist"), { recursive: true, force: true });
  if (existsSync(join(dest, "out"))) rmSync(join(dest, "out"), { recursive: true, force: true });
  if (existsSync(join(dest, "release"))) rmSync(join(dest, "release"), { recursive: true, force: true });

  for (const dir of ["deploy", "dist"]) {
    const target = join(dest, dir);
    rmSync(target, { recursive: true, force: true });
  }
}

if (!existsSync(SRC)) {
  console.error("Error: template/ directory not found at", SRC);
  process.exit(1);
}

if (existsSync(DEST)) {
  rmSync(DEST, { recursive: true });
}

cpSync(SRC, DEST, {
  recursive: true,
  filter: (s) => {
    const parts = s.split(/[\\/]/);
    const basename_ = parts.pop();
    const skipDirs = new Set(["node_modules", ".git", "dist", "coverage", "out", "release"]);
    const skipRootDirs = new Set(["deploy"]);
    const skipFiles = new Set(["deno.lock", "package-lock.json", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]);
    const depth = parts.length;
    
    // Check if path is in modules/*/__tests__ or modules/*/tests - allow it
    const inAllowedModuleTests = (() => {
      const idx = parts.findIndex(p => p === "modules");
      if (idx >= 0 && parts[idx + 1] && (parts[idx + 2] === "__tests__" || parts[idx + 2] === "tests" || parts[idx + 3] === "__tests__" || parts[idx + 3] === "tests")) {
        return true;
      }
      return false;
    })();
    
    // Skip test files except if in modules/*/__tests__
    const isTestFile = /\.(test|spec)\.(ts|js|tsx|jsx|mjs|cjs)$/i.test(basename_);
    if (isTestFile && !inAllowedModuleTests) return false;
    
    // Skip __tests__ dirs except under modules
    if ((basename_ === "__tests__" || basename_ === "tests") && !inAllowedModuleTests) return false;
    
    return !parts.some((p) => skipDirs.has(p) && !(inAllowedModuleTests && (p === "__tests__" || p === "tests")))
      && !skipDirs.has(basename_) && !(inAllowedModuleTests && (basename_ === "__tests__" || basename_ === "tests") && parts.some(p => p === "modules"))
      && !(depth === 1 && skipRootDirs.has(basename_))
      && !skipFiles.has(basename_)
      && !/\.sqlite($|[-.])/i.test(basename_)
      && !basename_.endsWith(".log");
  },
});

// Rename .gitignore to gitignore-stub
const gitignorePath = join(DEST, ".gitignore");
if (existsSync(gitignorePath)) {
  renameSync(gitignorePath, join(DEST, "gitignore-stub"));
  console.log("  renamed .gitignore → gitignore-stub (npm ignores .gitignore)");
}

// Pin env defaults
for (const file of [".env", ".env.example"]) {
  const envPath = join(DEST, file);
  if (!existsSync(envPath)) continue;
  const original = readFileSync(envPath, "utf8");
  const pinned = pinEnvDefaults(original, `template ${file}`);
  if (pinned !== original) writeFileSync(envPath, pinned);
}
reportEnvDrift(join(DEST, ".env.example"), join(DEST, ".env"), "template");

sanitizeScaffold(DEST, "template");

// Guard: prevent relative imports that would break bare specifiers
const importsMap = existsSync(join(DEST, "package.json"))
  ? JSON.parse(readFileSync(join(DEST, "package.json"), "utf8")).imports ?? {}
  : {};
// Also check tsconfig paths if present
const tsconfigPath = join(DEST, "tsconfig.json");
let tsPaths = {};
if (existsSync(tsconfigPath)) {
  try {
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
    tsPaths = tsconfig.compilerOptions?.paths || {};
  } catch {}
}
const allImports = { ...importsMap, ...Object.keys(tsPaths).reduce((acc, k) => ({ ...acc, [k.replace('/*','')]: './' }), {}) };

const extensions = new Set([".ts", ".tsx", ".vue", ".js", ".jsx", ".mjs", ".cjs", ".stub"]);
const offenders = [];
const scanDir = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
      continue;
    }
    if (!extensions.has(extname(entry.name))) continue;
    const text = readFileSync(full, "utf8");
    for (const key of Object.keys(allImports)) {
      if (!key || key === '.') continue;
      for (const prefix of [`'./${key}`, `"./${key}`]) {
        if (text.includes(prefix)) offenders.push(`${relative(DEST, full)}: found relative import "${prefix.slice(1, -1)}"`);
      }
    }
  }
};
scanDir(DEST);
if (offenders.length > 0) {
  console.error("Error: template contains relative imports that should be bare/aliased:");
  for (const line of [...new Set(offenders)]) console.error("  " + line);
  console.error("Fix the source template (template/), then re-run this script.");
  process.exit(1);
}

console.log("Template synced to packages/create-deskapp/template/");
