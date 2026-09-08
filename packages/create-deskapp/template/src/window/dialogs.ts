/**
 * window/dialogs.ts - native file/folder pickers, cross-platform.
 *
 * Deno Desktop does not expose a native file-picker API yet (it is on the
 * roadmap), so each platform gets its genuine OS dialog behind one shared API:
 *
 *   windows -> .NET WinForms (OpenFileDialog / SaveFileDialog /
 *              FolderBrowserDialog) hosted by a hidden wscript -> Powershell
 *              chain, so no console window ever flashes.
 *   darwin  -> osascript (JXA) with NSOpenPanel / NSSavePanel via AppKit.
 *   linux   -> zenity (GNOME) with kdialog (KDE) as fallback.
 *
 * `pickers.open` / `pickers.save` / `pickers.folder` return the chosen path,
 * or null when the user cancels or the dialog fails. The frontend and facade
 * are platform-agnostic; only the backend below knows which OS it is on.
 */

import { join } from "@std/path";

export interface PickOpenOptions {
  title?: string;
  filter?: string;
}

export interface PickSaveOptions {
  title?: string;
  defaultName?: string;
  filter?: string;
}

export interface PickFolderOptions {
  title?: string;
}

type DialogSpec =
  | { mode: "open"; title: string; filter: string }
  | { mode: "save"; title: string; filter: string; defaultName?: string }
  | { mode: "folder"; title: string };

/** Run the right backend for the current OS. */
function runDialog(spec: DialogSpec): Promise<string | null> {
  switch (Deno.build.os) {
    case "windows":
      return runWindowsDialog(spec);
    case "darwin":
      return runMacDialog(spec);
    case "linux":
      return runLinuxDialog(spec);
    default:
      throw new Error(`no native dialog backend for OS '${Deno.build.os}'`);
  }
}

/* ---------------------------------------------------------------------------
 * Windows backend: .NET WinForms dialogs through wscript (no console flash)
 * ------------------------------------------------------------------------ */

function quotePs(s: string): string {
  return "'" + s.replace(/'/g, "''") + "'";
}

function quoteVbs(s: string): string {
  return '"' + s.replace(/"/g, '""') + '"';
}

function buildWindowsPs(spec: DialogSpec, resultPath: string): string {
  const writeSel = (sel: string) =>
    `${sel} | Out-File -FilePath ${quotePs(resultPath)} -Encoding UTF8; ${sel}\n`;
  const head =
    "Add-Type -AssemblyName System.Windows.Forms\n" +
    `$res = ${quotePs(resultPath)}\n`;

  if (spec.mode === "folder") {
    return (
      head +
      "$d = New-Object System.Windows.Forms.FolderBrowserDialog\n" +
      `$d.Description = ${quotePs(spec.title)}\n` +
      "$d.ShowNewFolderButton = $true\n" +
      `if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { ${writeSel("$d.SelectedPath")} }\n`
    );
  }

  const klass = spec.mode === "open" ? "OpenFileDialog" : "SaveFileDialog";
  let body = head + `$d = New-Object System.Windows.Forms.${klass}\n`;
  body += `$d.Title = ${quotePs(spec.title)}\n`;
  body += `$d.Filter = ${quotePs(spec.filter)}\n`;
  if (spec.mode === "save") {
    if (spec.defaultName) body += `$d.FileName = ${quotePs(spec.defaultName)}\n`;
    body += "$d.OverwritePrompt = $true\n";
  }
  return body + `if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { ${writeSel("$d.FileName")} }\n`;
}

function buildWindowsVbs(psPath: string): string {
  const cmd =
    "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass " +
    "-STA -WindowStyle Hidden -File " + quoteVbs(psPath);
  return (
    "Set fso = CreateObject(\"Scripting.FileSystemObject\")\n" +
    "Set ws = CreateObject(\"WScript.Shell\")\n" +
    "ws.Run " + quoteVbs(cmd) + ", 0, True\n"
  );
}

async function cleanupDir(dir: string): Promise<void> {
  try {
    await Deno.remove(dir, { recursive: true });
  } catch {
    // best-effort temp cleanup
  }
}

async function runWindowsDialog(spec: DialogSpec): Promise<string | null> {
  const dir = await Deno.makeTempDir({ prefix: "deskapp-dialog-" });
  const psPath = join(dir, "dialog.ps1");
  const vbsPath = join(dir, "dialog.vbs");
  const resultPath = join(dir, "result.txt");

  try {
    // BOM forces PowerShell 5.1 to parse the script as UTF-8.
    await Deno.writeTextFile(psPath, "\uFEFF" + buildWindowsPs(spec, resultPath));
    await Deno.writeTextFile(vbsPath, buildWindowsVbs(psPath));

    const cmd = new Deno.Command("wscript.exe", {
      args: [vbsPath],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await cmd.output();
    if (code !== 0) return null;

    let raw: string;
    try {
      raw = await Deno.readTextFile(resultPath);
    } catch {
      return null;
    }
    const out = raw.replace(/^\uFEFF/, "").trim();
    return out.length > 0 ? out : null;
  } finally {
    await cleanupDir(dir);
  }
}

/* ---------------------------------------------------------------------------
 * macOS backend: osascript (JXA) + AppKit NSOpenPanel / NSSavePanel
 * ------------------------------------------------------------------------ */

function quoteJs(s: string): string {
  return JSON.stringify(s);
}

function buildJxa(spec: DialogSpec): string {
  const open = (
    canFiles: boolean,
    canDirs: boolean,
    title: string,
    saveName?: string,
  ): string => {
    const klass = saveName === undefined ? "NSOpenPanel" : "NSSavePanel";
    let src =
      `ObjC.import('AppKit');` +
      `const p = $.${klass}.${saveName === undefined ? "openPanel" : "savePanel"};` +
      `p.title = ${quoteJs(title)};`;
    if (saveName === undefined) {
      src += `p.canChooseFiles = ${canFiles}; p.canChooseDirectories = ${canDirs}; p.allowsMultipleSelection = false;`;
    } else {
      src += `p.nameFieldStringValue = ${quoteJs(saveName)}; p.canCreateDirectories = true;`;
    }
    src += `p.directoryURL = $.NSURL.fileURLWithPath($.NSHomeDirectory());`;
    return (
      src +
      `if (p.runModal() === 1) { return p.URL ? String(p.URL.path) : ''; } return '';`
    );
  };

  switch (spec.mode) {
    case "open":
      return open(true, false, spec.title);
    case "save":
      return open(false, false, spec.title, spec.defaultName ?? "");
    case "folder":
      return open(false, true, spec.title);
  }
}

async function runMacDialog(spec: DialogSpec): Promise<string | null> {
  const cmd = new Deno.Command("osascript", {
    args: ["-l", "JavaScript", "-e", buildJxa(spec)],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout } = await cmd.output();
  if (code !== 0) return null;
  const out = new TextDecoder().decode(stdout).trim();
  return out.length > 0 ? out : null;
}

/* ---------------------------------------------------------------------------
 * Linux backend: zenity (GNOME), falling back to kdialog (KDE)
 * ------------------------------------------------------------------------ */

async function runZenity(spec: DialogSpec): Promise<string | null> {
  const args: string[] = ["--file-selection"];
  switch (spec.mode) {
    case "save":
      args.push("--save", "--confirm-overwrite");
      if (spec.defaultName) args.push("--filename", spec.defaultName);
      break;
    case "folder":
      args.push("--directory");
      break;
    case "open":
      break;
  }
  args.push("--title", spec.title);

  const cmd = new Deno.Command("zenity", { args, stdout: "piped", stderr: "piped" });
  const { code, stdout } = await cmd.output();
  if (code !== 0) return null;
  const out = new TextDecoder().decode(stdout).trim();
  return out.length > 0 ? out : null;
}

async function runKdialog(spec: DialogSpec): Promise<string | null> {
  const home = Deno.env.get("HOME") ?? ".";
  const args: string[] = [];
  switch (spec.mode) {
    case "save":
      args.push("--getsavefilename", home, spec.filter, spec.defaultName ?? "");
      break;
    case "folder":
      args.push("--getexistingdirectory", home);
      break;
    case "open":
      args.push("--getopenfilename", home, spec.filter);
      break;
  }

  const cmd = new Deno.Command("kdialog", { args, stdout: "piped", stderr: "piped" });
  const { code, stdout } = await cmd.output();
  if (code !== 0) return null;
  const out = new TextDecoder().decode(stdout).trim();
  return out.length > 0 ? out : null;
}

async function runLinuxDialog(spec: DialogSpec): Promise<string | null> {
  try {
    return await runZenity(spec);
  } catch {
    // zenity binary missing -> fall back to kdialog
  }
  try {
    return await runKdialog(spec);
  } catch {
    throw new Error("no native dialog tool found on Linux (tried zenity, kdialog)");
  }
}

/* ---------------------------------------------------------------------------
 * Public API (shared across all platforms)
 * ------------------------------------------------------------------------ */

function pickOpenPath(options: PickOpenOptions = {}): Promise<string | null> {
  return runDialog({
    mode: "open",
    title: options.title ?? "Open a file",
    filter: options.filter ?? "All files (*.*)|*.*",
  });
}

/** Native "Save As" dialog. Returns the chosen path or null on cancel. */
function pickSavePath(options: PickSaveOptions = {}): Promise<string | null> {
  return runDialog({
    mode: "save",
    title: options.title ?? "Save as",
    filter: options.filter ?? "All files (*.*)|*.*",
    defaultName: options.defaultName,
  });
}

/** Native folder-chooser. Returns the chosen folder or null on cancel. */
function pickFolder(options: PickFolderOptions = {}): Promise<string | null> {
  return runDialog({ mode: "folder", title: options.title ?? "Choose a folder" });
}

/**
 * pickers - native file/folder pickers. Access through the facade:
 *   import { pickers } from "@/core/facade.ts";
 *   const path = await pickers.open({ title: "Open a file" });
 */
export const pickers = {
  open: pickOpenPath,
  save: pickSavePath,
  folder: pickFolder,
};