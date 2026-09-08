#!/usr/bin/env -S deno run -A

/**
 * index.ts — the `./create` entry of `@niyam/deskapp`.
 *
 * `deno create jsr:@niyam/deskapp my-app` downloads this package and runs
 * this script. The scaffold content lives in ../template (a clean sync of the
 * repo's live template/, produced by scripts/sync-template.mjs). The script
 * copies it into ./my-app, materializes `.gitignore` from the gitignore-stub,
 * writes `.env` from `.env.example`, renames the app, and prints next steps.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE = fileURLToPath(new URL("../template/", import.meta.url));

interface Args {
  name?: string;
  force?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (const a of argv) {
    if (a === "--force" || a === "-f") args.force = true;
    else if (!a.startsWith("--")) args.name = a;
  }
  return args;
}

function isValidName(name: string): boolean {
  return /^[a-z0-9@][a-z0-9._-]*$/i.test(name);
}

function toPascal(name: string): string {
  return name.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, "");
}

function main(): void {
  const { name, force } = parseArgs(Deno.args);

  if (!name || !isValidName(name)) {
    console.error(
      "Usage: deno run -A jsr:@niyam/deskapp/create <project-name> [--force]",
    );
    console.error("Project name may use alphanumeric, dashes, or underscores.");
    Deno.exit(1);
  }

  const target = resolve(name);

  if (existsSync(target)) {
    if (!force) {
      console.error(`Error: Directory "${name}" already exists. Pass --force to overwrite it.`);
      Deno.exit(1);
    }
    rmSync(target, { recursive: true, force: true });
  }

  mkdirSync(target, { recursive: true });
  cpSync(TEMPLATE, target, { recursive: true });

  const gitignoreStub = join(target, "gitignore-stub");
  if (existsSync(gitignoreStub)) {
    renameSync(gitignoreStub, join(target, ".gitignore"));
  }

  const envPath = join(target, ".env");
  if (!existsSync(envPath)) {
    const examplePath = join(target, ".env.example");
    if (existsSync(examplePath)) {
      writeFileSync(envPath, readFileSync(examplePath, "utf-8"));
    }
  }

  const denoJsonPath = join(target, "deno.json");
  if (existsSync(denoJsonPath)) {
    const cfg = JSON.parse(readFileSync(denoJsonPath, "utf-8"));
    if (cfg?.desktop?.app?.name === "Deskapp") {
      cfg.desktop.app.name = toPascal(name);
    }
    writeFileSync(denoJsonPath, JSON.stringify(cfg, null, 2) + "\n");
  }

  console.log(`Done! Created "${name}" at ${target}`);
  console.log();
  console.log("  cd " + name);
  console.log("  deno install              # resolve deps (vite, sass, drizzle, ...)");
  console.log("  deno task dev             # codegen + build UI + open the desktop window");
  console.log("  deno run -A src/main.ts   # headless (no window, tray-only)");
  console.log();
  console.log("Tune your app: edit deno.json > desktop.app.name and deepLinks,");
  console.log("the icon files in src/icons/, and the frontend in src/ui/.");
}

main();