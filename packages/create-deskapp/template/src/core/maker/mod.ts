import { Command } from "@cliffy/command";
import { registerDbCommands } from "@/core/maker/db/mod.ts";
import { renderGroupedHelp } from "@/core/maker/help.ts";
import { registerMakeCommands } from "@/core/maker/make/mod.ts";
import { registerRunCommands } from "@/core/maker/run/mod.ts";

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
