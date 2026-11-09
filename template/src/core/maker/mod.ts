import { registerDbCommands } from "./db/mod";
import { printCommandHelp, printHelp, type CommandDef } from "./help";
import { registerMakeCommands } from "./make/mod";
import { registerRunCommands } from "./run/mod";

const commands = new Map<string, CommandDef>();

function register(cmd: CommandDef) {
  commands.set(cmd.name, cmd);
}

registerMakeCommands(register);
registerDbCommands(register);
registerRunCommands(register);

function parseFlags(argv: string[]): { flags: Record<string, string | boolean>; positionals: string[] } {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (key === "no-zip") {
          flags.zip = false;
        } else if (next !== undefined && !next.startsWith("--")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    printHelp(commands);
    return;
  }
  if (argv[0] === "help") {
    const target = argv[1];
    if (target && commands.has(target)) printCommandHelp(commands.get(target)!);
    else printHelp(commands);
    return;
  }

  const name = argv[0];
  const cmd = commands.get(name);
  if (!cmd) {
    console.error(`\n  Unknown command: ${name}\n`);
    printHelp(commands);
    process.exit(1);
  }

  const { flags, positionals } = parseFlags(argv.slice(1));
  if (flags.help || flags.h) {
    printCommandHelp(cmd);
    return;
  }

  try {
    await cmd.action(flags, positionals);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
