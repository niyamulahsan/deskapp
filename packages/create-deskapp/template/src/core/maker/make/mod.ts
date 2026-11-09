import type { CommandDef } from "../help";
import type { MakerOptions } from "./helpers";
import { makeController } from "./controller";
import { makeModule } from "./module";
import { makeModel } from "./model";
import { makeSeeder } from "./seeder";
import { makeTest } from "./test";

const GROUP = "Generators - modules";

function opts(flags: Record<string, string | boolean>): MakerOptions {
  return { force: Boolean(flags.force), dryRun: Boolean(flags["dry-run"] ?? flags.dryRun) };
}

function need(args: string[], i: number, label: string): string {
  const v = args[i];
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

export function registerMakeCommands(register: (cmd: CommandDef) => void): void {
  register({
    name: "make:module",
    usage: "<name> [--force]",
    group: GROUP,
    description: "Create a module with model, seeder, controller + schema",
    action: (flags, args) => makeModule(need(args, 0, "Module name"), opts(flags)),
  });
  register({
    name: "make:controller",
    usage: "<module> <name> [--force] [--dry-run]",
    group: GROUP,
    description: "Generate a controller + schema for an existing module",
    action: (flags, args) => makeController(need(args, 0, "Module name"), need(args, 1, "Controller name"), opts(flags)),
  });
  register({
    name: "make:model",
    usage: "<module> <name> [--force] [--dry-run]",
    group: GROUP,
    description: "Generate a model file for an existing module",
    action: (flags, args) => makeModel(need(args, 0, "Module name"), need(args, 1, "Model name"), opts(flags)),
  });
  register({
    name: "make:seeder",
    usage: "<module> <name> [--force] [--dry-run]",
    group: GROUP,
    description: "Generate a seeder for an existing module model",
    action: (flags, args) => makeSeeder(need(args, 0, "Module name"), need(args, 1, "Seeder name"), opts(flags)),
  });

  const testAction = (flags: Record<string, string | boolean>, args: string[]) =>
    makeTest(need(args, 0, "Module name"), args[1], opts(flags));
  register({
    name: "make:test",
    usage: "<module> [name] [--force] [--dry-run]",
    group: GROUP,
    description: "Generate a Vitest file in src/modules/<module>/__tests__",
    action: testAction,
  });
  register({
    name: "module:make-test",
    usage: "<module> [name] [--force] [--dry-run]",
    group: GROUP,
    description: "Alias for make:test (Nexwire-style)",
    action: testAction,
  });
}

