import type { Command } from "@cliffy/command";
import type { MakerOptions } from "./helpers.ts";
import { makeController } from "./controller.ts";
import { makeModule } from "./module.ts";
import { makeModel } from "./model.ts";
import { makeSeeder } from "./seeder.ts";

function run(action: () => void): void {
  try {
    action();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

function toOptions(force: unknown, dryRun: unknown): MakerOptions {
  return { force: Boolean(force), dryRun: Boolean(dryRun) };
}

/** Register the make:* subcommand family on the maker CLI. */
export function registerMakeCommands(program: Command): void {
  program
    .command("make:module", "Create a module folder with a barebones model, seeder, controller + schema")
    .arguments("<name:string>")
    .option("--force", "Overwrite existing module files")
    .action((options, name) =>
      run(() => makeModule(name, toOptions(options.force, undefined)))
    )
    .command("make:model", "Create a model file in an existing module")
    .arguments("<module:string> <name:string>")
    .option("--force", "Overwrite the file if it exists")
    .option("--dry-run", "Print the target path without writing")
    .action((options, module, name) =>
      run(() => makeModel(module, name, toOptions(options.force, options.dryRun)))
    )
    .command("make:seeder", "Create a seeder file for a module model")
    .arguments("<module:string> <name:string>")
    .option("--force", "Overwrite the file if it exists")
    .option("--dry-run", "Print the target path without writing")
    .action((options, module, name) =>
      run(() => makeSeeder(module, name, toOptions(options.force, options.dryRun)))
    )
    .command("make:controller", "Create a controller + schema pair for a module")
    .arguments("<module:string> <name:string>")
    .option("--force", "Overwrite the files if they exist")
    .option("--dry-run", "Print the target paths without writing")
    .action((options, module, name) =>
      run(() => makeController(module, name, toOptions(options.force, options.dryRun)))
    );
}
