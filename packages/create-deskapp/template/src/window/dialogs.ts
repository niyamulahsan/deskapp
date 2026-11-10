import { BrowserWindow, dialog } from "electron";

// ---------------------------------------------------------------------------
// Message dialogs (confirm / alert / prompt)
// ---------------------------------------------------------------------------

export async function confirmDialog(message: string): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: "question",
    buttons: ["Cancel", "OK"],
    title: "Confirm",
    message: message
  });

  return result.response === 1;
}

export async function alertDialog(message: string): Promise<void> {
  await dialog.showMessageBox({
    type: "info",
    title: "Alert",
    message: message
  });
}

export interface PickOpenOptions {
  title?: string;
  filter?: string; // Electron uses extensions array, but we can parse your string
}

export interface PickSaveOptions {
  title?: string;
  defaultName?: string;
  filter?: string;
}

export interface PickFolderOptions {
  title?: string;
}

// Helper to convert "All files (*.*)|*.*" to Electron format: [{ name: 'All files', extensions: ['*'] }]
export function parseFilter(filterStr?: string) {
  if (!filterStr) return undefined;
  const parts = filterStr.split("|");
  const filters = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i] && parts[i + 1]) {
      filters.push({
        name: parts[i].replace(/\s*\(.*?\)\s*/, ""),
        extensions: parts[i + 1].split(";").map((ext) => ext.replace("*.", "").replace("*", "*"))
      });
    }
  }
  return filters.length > 0 ? filters : undefined;
}

async function pickOpenPath(options: PickOpenOptions = {}): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win!, {
    title: options.title ?? "Open a file",
    properties: ["openFile"],
    filters: parseFilter(options.filter)
  });
  return result.canceled ? null : result.filePaths[0];
}

async function pickSavePath(options: PickSaveOptions = {}): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win!, {
    title: options.title ?? "Save as",
    defaultPath: options.defaultName,
    filters: parseFilter(options.filter)
  });
  return result.canceled ? null : result.filePath || null;
}

async function pickFolder(options: PickFolderOptions = {}): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win!, {
    title: options.title ?? "Choose a folder",
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
}

export const pickers = {
  open: pickOpenPath,
  save: pickSavePath,
  folder: pickFolder
};
