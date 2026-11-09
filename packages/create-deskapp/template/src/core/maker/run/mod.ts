import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandDef } from "../help";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function run(cmd: string, args: string[], opts: { cwd?: string; label?: string } = {}): void {
  console.log(`== ${opts.label ?? cmd} ==`);
  const isWin = process.platform === "win32";
  const r = spawnSync(isWin ? "cmd.exe" : cmd, isWin ? ["/d", "/s", "/c", cmd, ...args] : args, {
    cwd: opts.cwd ?? ROOT,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function tsxScript(script: string, label: string): void {
  run("npx", ["--yes", "tsx", "--tsconfig", "tsconfig.json", script], { label });
}

function configSync(): void {
  tsxScript("src/core/maker/sync-config.ts", "config:sync");
}

function schemaAndBindings(): void {
  configSync();
  tsxScript("src/core/database/aggregate.ts", "schema (db:schema)");
  tsxScript("src/core/api/generate.manifest.ts", "bindings (bindings:gen)");
}

export function registerRunCommands(register: (cmd: CommandDef) => void): void {
  register({
    name: "dev",
    group: "Getting started",
    description: "Start Electron + Vite UI (HMR) + esbuild watch for main/preload",
    action: () => {
      schemaAndBindings();
      run("npm", ["run", "dev"], { label: "dev" });
    },
  });

  register({
    name: "ui",
    group: "Getting started",
    description: "Start Vite dev server for the renderer only (no Electron bindings)",
    action: () => run("npx", ["vite", "--config", "src/ui/vite.config.ts"], { label: "vite dev", cwd: ROOT }),
  });

  register({
    name: "start",
    group: "Getting started",
    description: "Run the built Electron app (loads src/ui/dist; requires build)",
    action: () => run("npm", ["run", "start"], { label: "start" }),
  });

  register({
    name: "config:sync",
    group: "Build & codegen",
    description: "Sync src/config/app.ts -> package.json build/identity + scripts/installer.nsh",
    action: () => configSync(),
  });

  register({
    name: "codegen",
    group: "Build & codegen",
    description: "Sync config + regenerate database schema + bindings manifest",
    action: () => schemaAndBindings(),
  });

  register({
    name: "bindings:gen",
    group: "Build & codegen",
    description: "Regenerate src/core/api/bindings.generated.ts from controllers",
    action: () => tsxScript("src/core/api/generate.manifest.ts", "bindings:gen"),
  });

  register({
    name: "build",
    group: "Build & codegen",
    description: "Build renderer UI + Electron main/preload bundles",
    action: () => {
      schemaAndBindings();
      run("npm", ["run", "build"], { label: "build", cwd: ROOT });
    },
  });

  register({
    name: "package",
    group: "Build & codegen",
    description: "Build and package installers with electron-builder",
    action: (flags) => {
      schemaAndBindings();
      run("npm", ["run", "build"], { label: "build" });
      const ebArgs = ["--yes", "electron-builder"];
      if (typeof flags.platform === "string") ebArgs.push(`--${flags.platform}`);
      if (typeof flags.target === "string") ebArgs.push(`--${flags.target}`);
      run("npx", ebArgs, { label: "electron-builder" });
    },
  });

  register({ name: "serve", group: "Getting started", description: "Alias for dev (Electron)", action: () => run("npm", ["run", "dev"], { label: "dev" }) });

  register({ name: "test", group: "Testing", description: "Run Vitest unit tests (node environment)", action: () => run("npx", ["vitest", "run"], { label: "test" }) });
  register({ name: "test:watch", group: "Testing", description: "Run Vitest in watch mode", action: () => run("npx", ["vitest"], { label: "test:watch" }) });
  register({ name: "test:coverage", group: "Testing", description: "Run Vitest with V8 coverage", action: () => run("npx", ["vitest", "run", "--coverage"], { label: "test:coverage" }) });
}
