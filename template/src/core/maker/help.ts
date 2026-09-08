import type { Command } from "@cliffy/command";

interface CommandRow {
  name: string;
  usage: string;
  desc: string;
}

interface Group {
  title: string;
  include: (name: string) => boolean;
  rows: CommandRow[];
}

const GROUP_DEFINITIONS: Array<{ title: string; include: (name: string) => boolean }> = [
  {
    title: "Scaffolding (make:*)",
    include: (name) => name.startsWith("make:"),
  },
  {
    title: "Database (db:*)",
    include: (name) => name.startsWith("db:"),
  },
  {
    title: "Run / Build / Bundle (dev, serve, ui, codegen, bindings:gen, build*, bundle*)",
    include: (name) =>
      name === "dev" || name === "serve" || name === "ui" ||
      name === "codegen" || name === "bindings:gen" ||
      name.startsWith("build") || name.startsWith("bundle"),
  },
];

function rowsOf(program: Command, include: (name: string) => boolean): CommandRow[] {
  const rows: CommandRow[] = [];
  for (const cmd of program.getCommands()) {
    const name = cmd.getName();
    if (!include(name)) continue;
    let usage = "";
    try {
      usage = cmd.getUsage();
    } catch {
      // commands without arguments still work - usage stays empty
    }
    rows.push({ name, usage, desc: cmd.getDescription() ?? "" });
  }
  return rows;
}

function renderGroup(group: Group): string[] {
  if (group.rows.length === 0) return [];
  const nameWidth = Math.max(...group.rows.map((r) => r.name.length));
  const usageWidth = Math.max(...group.rows.map((r) => r.usage.length));
  const lines: string[] = [];
  lines.push(group.title + ":");
  for (const row of group.rows) {
    lines.push(
      row.usage === ""
        ? `  ${row.name.padEnd(nameWidth)}  - ${row.desc}`
        : `  ${row.name.padEnd(nameWidth)}  ${row.usage.padEnd(usageWidth)}  - ${row.desc}`,
    );
  }
  lines.push("");
  return lines;
}

/** Render the maker help with the command families separated into groups. */
export function renderGroupedHelp(program: Command): string {
  const groups: Group[] = GROUP_DEFINITIONS.map((definition) => ({
    ...definition,
    rows: rowsOf(program, definition.include),
  }));
  const leftover = groupUpLeftovers(program, groups);

  const output: string[] = [];
  output.push(`Usage:   ${program.getName()}${program.getVersion() ? `\nVersion: ${program.getVersion()}` : ""}`);
  output.push("");
  output.push("Description:");
  output.push("");
  output.push(`  ${program.getDescription() ?? ""}`);
  output.push("");
  output.push("Options:");
  output.push("");
  output.push("  -h, --help        Show this help.");
  output.push("");
  output.push("Commands:");
  output.push("");
  for (const group of [...groups, leftover]) {
    output.push(...renderGroup(group));
  }
  return output.join("\n") + "\n";
}

function groupUpLeftovers(program: Command, groups: Group[]): Group {
  const known = new Set(groups.flatMap((g) => g.rows.map((r) => r.name)));
  return {
    title: "Other",
    include: () => true,
    rows: rowsOf(program, (name) => !known.has(name)),
  };
}