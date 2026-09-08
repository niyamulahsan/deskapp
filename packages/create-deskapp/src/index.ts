#!/usr/bin/env -S deno run -A

/**
 * index.ts — the `./create` entry of `@niyam/deskapp`.
 *
 * `deno create jsr:@niyam/deskapp` downloads this package, runs the `./create`
 * entry, and scaffolds the starter project. When run with a project name it
 * creates a new folder; when run without one it scaffolds into the current
 * directory (the `deno create` flow). The scaffold content lives in
 * ../template — a clean sync of the repo's live template/ produced by
 * scripts/sync-template.mjs. The script copies it into place, materializes
 * `.gitignore` from the gitignore-stub, writes `.env` from `.env.example`,
 * renames the app, and prints next steps.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
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
  const inPlace = !name;
  const projectName = inPlace ? basename(resolve(".")) : name!;

  if (!isValidName(projectName)) {
    console.error(`Error: "${projectName}" is not a valid project name.`);
    console.error(
      "Project names must use letters, digits, dashes, or underscores.",
    );
    console.error();
    console.error("Usage:");
    console.error("  deno create jsr:@niyam/deskapp            # run inside your new project folder");
    console.error("  deno run -A jsr:@niyam/deskapp/create <project-name> [--force]");
    Deno.exit(1);
  }

  const target = inPlace ? resolve(".") : resolve(projectName);

  if (inPlace) {
    if (readdirSync(target).length > 0 && !force) {
      console.error(
        `Error: the current directory is not empty. Run in an empty folder, or scaffold with a name:`,
      );
      console.error("  deno run -A jsr:@niyam/deskapp/create <project-name> [--force]");
      Deno.exit(1);
    }
  } else {
    if (existsSync(target)) {
      if (!force) {
        console.error(
          `Error: Directory "${projectName}" already exists. Pass --force to overwrite it.`,
        );
        Deno.exit(1);
      }
      rmSync(target, { recursive: true, force: true });
    }
    mkdirSync(target, { recursive: true });
  }

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
      cfg.desktop.app.name = toPascal(projectName);
    }
    writeFileSync(denoJsonPath, JSON.stringify(cfg, null, 2) + "\n");
  }

  console.log(inPlace
    ? `Done! Created deskapp project "${projectName}" in the current directory.`
    : `Done! Created "${projectName}" at ${target}`);
  console.log();
  if (!inPlace) console.log("  cd " + projectName);
  console.log("  deno install              # resolve deps (vite, sass, drizzle, ...)");
  console.log("  deno task dev             # codegen + build UI + open the desktop window");
  console.log("  deno run -A src/main.ts   # headless (no window, tray-only)");
  console.log();
  console.log("Tune your app: edit deno.json > desktop.app.name and deepLinks,");
  console.log("the icon files in src/icons/, and the frontend in src/ui/.");
}

main();