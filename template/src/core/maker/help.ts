export interface CommandDef {
  name: string;
  usage?: string;
  description: string;
  group: string;
  action: (flags: Record<string, string | boolean>, args: string[]) => void | Promise<void>;
}

const WORDMARK = [
  "  ____  _____ ____  _  __    _    ____  ____  ",
  " |  _ \\| ____/ ___|| |/ /   / \\  |  _ \\|  _ \\ ",
  " | | | |  _| \\___ \\| ' /   / _ \\ | |_) | |_) |",
  " | |_| | |___ ___) | . \\  / ___ \\|  __/|  __/ ",
  " |____/|_____|____/|_|\\_\\/_/   \\_\\_|   |_|    ",
];

const LOGO = "\n" + WORDMARK.join("\n") + "\n";

const GROUP_ORDER = [
  "Getting started",
  "Generators - modules",
  "Database",
  "Build & codegen",
  "Testing",
];

function padRows(rows: Array<{ left: string; desc: string }>): string[] {
  if (!rows.length) return [];
  const w = Math.max(...rows.map((r) => r.left.length));
  return rows.map((r) => `  ${r.left.padEnd(w)}  ${r.desc}`);
}

export function printCommandHelp(cmd: CommandDef): void {
  console.log(LOGO);
  console.log(`Usage: npm run maker -- ${cmd.name}${cmd.usage ? " " + cmd.usage : ""} [options]\n`);
  console.log(cmd.description + "\n");
}

export function printHelp(commands: Map<string, CommandDef>): void {
  console.log(LOGO);
  console.log("Usage: npm run maker -- [options] [command]\n");
  console.log("Options:");
  console.log("  -h, --help  display help for command\n");

  const byGroup = new Map<string, CommandDef[]>();
  for (const cmd of commands.values()) {
    const g = cmd.group || "Other";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(cmd);
  }
  for (const arr of byGroup.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

  const groups = [
    ...GROUP_ORDER.filter((g) => byGroup.has(g)),
    ...[...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g)),
  ];
  for (const group of groups) {
    const rows = (byGroup.get(group) || []).map((c) => ({ left: c.name, desc: c.description }));
    if (!rows.length) continue;
    console.log(`${group}:`);
    for (const line of padRows(rows)) console.log(line);
    console.log("");
  }

  console.log("Run `npm run maker -- <command> --help` for command details.");
}
