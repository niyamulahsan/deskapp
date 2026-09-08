import { Command } from "@cliffy/command";
import { registerDbCommands } from "./db/mod.ts";
import { renderGroupedHelp } from "./help.ts";
import { registerMakeCommands } from "./make/mod.ts";
import { registerRunCommands } from "./run/mod.ts";

const program = new Command()
  .name("maker")
  .description(
    "Scaffold modules and models, run database operations, and drive the dev/build/bundle workflow.",
  )
  .version("1.0.0");

registerMakeCommands(program);
registerDbCommands(program);
registerRunCommands(program);

// Replace the flat command list with a grouped one (Scaffolding / Database / Run-Build-Bundle).
program.getHelp = () => renderGroupedHelp(program);

await program.parse(Deno.args);
