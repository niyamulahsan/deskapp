import type { Command } from "@cliffy/command";
import { fromFileUrl, join } from "@std/path";

const ROOT = fromFileUrl(new URL("../../../..", import.meta.url));
const UI_DIR = join(ROOT, "src", "ui");

/** Run a process from the project root (or another cwd), inheriting output. */
function spawn(program: string, args: string[], opts: { cwd?: string; label?: string } = {}): void {
  console.log(`== ${opts.label ?? program} ==`);
  const { code } = new Deno.Command(program, {
    args,
    cwd: opts.cwd ?? ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).outputSync();
  if (code !== 0) Deno.exit(code);
}

function deno(args: string[], opts: { cwd?: string; label?: string } = {}): void {
  spawn("deno", args, opts);
}

const INCLUDES = [
  "--include=./src/ui/dist",
  "--include=./src/storage",
  "--include=./src/icons",
];

function schemaAndBindings(): void {
  deno(["run", "-A", "src/core/database/aggregate.ts"], { label: "schema (db:schema)" });
  deno(["run", "-A", "src/core/api/generate.manifest.ts"], { label: "bindings (bindings:gen)" });
}

function viteBuild(): void {
  deno(["run", "-A", "npm:vite", "build"], { cwd: UI_DIR, label: "build UI" });
}

function desktopForBuild(target?: string): void {
  const args = ["desktop", "-A"];
  if (target) args.push("--target", target);
  args.push(...INCLUDES, "src/main.ts");
  deno(args, { label: "deno desktop" });
}

interface BundleFlags {
  ui?: string;
  chromium?: string;
  output?: string;
  noZip?: boolean;
}

function bundleFlags(options: Record<string, unknown>): BundleFlags {
  const str = (v: unknown): string | undefined =>
    [v].flat().find((entry) => typeof entry === "string") as string | undefined;
  return {
    ui: str(options.ui),
    chromium: str(options.chromium),
    output: str(options.output),
    noZip: [options.zip].flat().find((entry) => typeof entry === "boolean") === false,
  };
}

function runBundle(env: string, target: string | undefined, flags: BundleFlags): void {
  const args = ["run", "-A", "src/core/bundle.ts"];
  if (target) args.push("--target", target);
  if (flags.ui) args.push(`--ui=${flags.ui}`);
  if (flags.chromium) args.push(`--chromium=${flags.chromium}`);
  if (flags.output) args.push("--output", flags.output);
  if (flags.noZip) args.push("--no-zip");
  deno(args, { label: `bundle (${env})` });
}

function registerBundleCommand(
  program: Command,
  name: string,
  env: string,
  target: string | undefined,
  desc: string,
): void {
  program
    .command(name, desc)
    .option("--ui <mode:string>", "auto (default) | skip | force")
    .option("--chromium <mode:string>", "auto (default) | skip | force")
    .option("--output <path:string>", "override the app output path")
    .option("--no-zip", "skip producing the zip archive")
    .action((options) => runBundle(env, target, bundleFlags(options)));
}

/** Register the dev/serve/build/bundle command family on the maker CLI. */
export function registerRunCommands(program: Command): void {
  program
    .command("dev", "codegen + build UI + open the desktop app with HMR")
    .action(() => {
      schemaAndBindings();
      viteBuild();
      deno(["desktop", "--env-file", "--hmr", "-A", "src/main.ts"], {
        label: "deno desktop (HMR)",
      });
    })
    .command("serve", "codegen + run the server (headless-aware)")
    .action(() => {
      schemaAndBindings();
      deno(["run", "-A", "--env-file", "src/main.ts"], { label: "serve" });
    })
    .command("ui", "Vite dev server in a browser tab (no bindings)")
    .action(() => deno(["run", "-A", "npm:vite"], { cwd: UI_DIR, label: "vite dev" }))
    .command("bindings:gen", "Regenerate src/core/api/bindings.generated.ts")
    .action(() =>
      deno(["run", "-A", "src/core/api/generate.manifest.ts"], { label: "bindings:gen" })
    )
    .command("codegen", "Regenerate database schema + bindings manifest")
    .action(schemaAndBindings)
    .command("build", "Build UI + desktop app for the host OS")
    .action(() => {
      viteBuild();
      desktopForBuild();
    });

  for (const [name, target] of [
    ["build:win", "x86_64-pc-windows-msvc"],
    ["build:mac", "x86_64-apple-darwin"],
    ["build:linux", "x86_64-unknown-linux-gnu"],
  ] as const) {
    program
      .command(name, `Cross-compile UI + desktop app for ${name.replace("build:", "")}`)
      .action(() => {
        viteBuild();
        desktopForBuild(target);
      });
  }

  registerBundleCommand(program, "bundle", "host", undefined, "Bundle the desktop app for the host OS");
  registerBundleCommand(program, "bundle:win", "win", undefined, "Bundle the desktop app for Windows");
  registerBundleCommand(program, "bundle:mac", "mac", "x86_64-apple-darwin", "Bundle the desktop app for macOS");
  registerBundleCommand(program, "bundle:linux", "linux", "x86_64-unknown-linux-gnu", "Bundle the desktop app for Linux");
}