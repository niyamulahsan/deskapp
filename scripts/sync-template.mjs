#!/usr/bin/env node

import { cpSync, rmSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
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

console.log("Template synced to packages/create-deskapp/template/");