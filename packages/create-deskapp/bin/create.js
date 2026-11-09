#!/usr/bin/env node

import { readFileSync, existsSync, cpSync, mkdirSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = join(__dirname, "..", "package.json");
const TEMPLATE_DIR = join(__dirname, "..", "template");

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));

async function ask(query) {
  const rl = (await import("node:readline")).createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a.trim()); }));
}

function isValidProjectName(name) {
  return /^[a-z0-9@][a-z0-9._-]*$/i.test(name);
}

function resolveTargetDir(name) {
  const cwd = process.cwd();
  if (name === ".") {
    const entries = readdirSync(cwd);
    if (entries.length > 0) {
      console.error(`Error: Current directory "${basename(cwd)}" is not empty.`);
      console.error("  Scaffolding into '.' requires an empty directory so existing files are not overwritten.");
      process.exit(1);
    }
    return cwd;
  }
  const dir = join(cwd, name);
  if (existsSync(dir)) {
    console.error(`Error: Directory "${name}" already exists.`);
    process.exit(1);
  }
  return dir;
}

function parseArgs(argv) {
  const args = { force: false };
  for (const a of argv) {
    if (a === "--force" || a === "-f") args.force = true;
    else if (!a.startsWith("--")) args.name = a;
  }
  return args;
}

async function main() {
  const { name, force } = parseArgs(process.argv.slice(2));
  
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`create-deskapp v${pkg.version}`);
    console.log();
    console.log("Usage:");
    console.log("  npm create @niyamulahsan/deskapp@latest <project-name|.> [--force]");
    console.log("  npx create-deskapp <project-name|.> [--force]");
    console.log();
    console.log("Options:");
    console.log("  -f, --force    Overwrite existing directory");
    console.log("  -h, --help     Show this help");
    process.exit(0);
  }
  
  let projectName = name;
  if (!projectName) {
    if (!process.stdin.isTTY) {
      console.error("Error: Please provide a project name or '.' to scaffold into the current directory.");
      process.exit(1);
    }
    projectName = await ask("Project name or '.' for the current directory: ");
  }
  
  if (!projectName) {
    console.error("Error: Please provide a project name or '.' to scaffold into the current directory.");
    process.exit(1);
  }
  
  if (projectName !== "." && !isValidProjectName(projectName)) {
    console.error("Error: Invalid project name.");
    process.exit(1);
  }
  
  const targetDir = resolveTargetDir(projectName);
  const isCurrentDir = targetDir === process.cwd();
  
  console.log(`\nCreating project "${projectName}"...\n`);
  mkdirSync(targetDir, { recursive: true });
  
  try {
    console.log("  Copying template files...");
    cpSync(TEMPLATE_DIR, targetDir, { recursive: true });
  } catch (err) {
    console.error("Error: Failed to copy template.");
    console.error("  " + err.message);
    if (!isCurrentDir) {
      // best effort cleanup
    }
    process.exit(1);
  }
  
  const gitignoreStub = join(targetDir, "gitignore-stub");
  if (existsSync(gitignoreStub)) {
    renameSync(gitignoreStub, join(targetDir, ".gitignore"));
  }
  
  const targetPkgPath = join(targetDir, "package.json");
  if (existsSync(targetPkgPath)) {
    try {
      const targetPkg = JSON.parse(readFileSync(targetPkgPath, "utf-8"));
      targetPkg.name = projectName === "." ? basename(targetDir) : projectName;
      writeFileSync(targetPkgPath, JSON.stringify(targetPkg, null, 2) + "\n");
    } catch {}
  }
  
  const pm = process.env.npm_config_user_agent?.includes('pnpm') ? 'pnpm' : 
             process.env.npm_config_user_agent?.includes('yarn') ? 'yarn' : 
             process.env.npm_config_user_agent?.includes('bun') ? 'bun' : 'npm';
  
  const cdName = projectName === "." ? basename(targetDir) : projectName;
  console.log(`Done! Created "${cdName}" at ${targetDir}`);
  console.log();
  if (projectName !== ".") {
    console.log("  cd " + cdName);
  }
  console.log("  " + pm + " install");
  console.log("  " + pm + " run dev");
  console.log();
  console.log("Enjoy building with Deskapp!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
