#!/usr/bin/env node

import { cpSync, rmSync, renameSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "template");
const DEST = join(ROOT, "packages", "create-deskapp", "template");

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
    const basename = parts.pop();
    const skipDirs = new Set(["node_modules", "dist", ".git"]);
    const skipFiles = new Set(["deno.lock", "package-lock.json"]);
    return !parts.some((p) => skipDirs.has(p))
      && !skipDirs.has(basename)
      && !skipFiles.has(basename)
      && !/\.sqlite($|[-.])/i.test(basename);
  },
});

// Rename .gitignore to gitignore-stub so JSR doesn't use its patterns
// for exclusion (and so the create script can materialize it per project).
const gitignorePath = join(DEST, ".gitignore");
if (existsSync(gitignorePath)) {
  renameSync(gitignorePath, join(DEST, "gitignore-stub"));
  console.log("  renamed .gitignore → gitignore-stub (JSR ignores .gitignore; materialized by ./create)");
}

// Guard: the scaffolded app resolves @/..., jsr: and npm: packages through the
// deno.json imports map, so those specifiers must stay BARE. If any file was
// rewritten into a relative "./..." import (e.g. an editor "convert to relative
// paths" pass ran before publishing), the scaffold breaks the moment their
// package isn't vendored next to the file. Fail the sync instead of shipping it.
const importsMap = existsSync(join(DEST, "deno.json"))
  ? JSON.parse(readFileSync(join(DEST, "deno.json"), "utf8")).imports ?? {}
  : {};
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
    for (const key of Object.keys(importsMap)) {
      for (const prefix of [`"./${key}`, `'./${key}`]) {
        if (text.includes(prefix)) offenders.push(`${relative(DEST, full)}: found relative import "${prefix.slice(1)}…"`);
      }
    }
  }
};
scanDir(DEST);
if (offenders.length > 0) {
  console.error("Error: template contains relative './' imports that must be bare specifiers:");
  for (const line of [...new Set(offenders)]) console.error("  " + line);
  console.error("Fix the source template (template/), then re-run this script.");
  process.exit(1);
}

// Emit a manifest of every file shipped inside the template. `deno create`
// executes ./create remotely (import.meta.url = https://jsr.io/...), so the
// create script must download the template files from the registry CDN.
// scripts can use this list (see src/index.ts) to fetch each file.
function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(DEST, full).split("\\").join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

const manifestPath = join(ROOT, "packages", "create-deskapp", "template.manifest.json");
writeFileSync(manifestPath, JSON.stringify(listFiles(DEST), null, 2) + "\n");
console.log("Template synced to packages/create-deskapp/template/" + ` (${manifestPath})`);