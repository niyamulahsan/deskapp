/**
 * storage.controller.ts (app module) - real file operations, all native.
 *
 * Every handler uses the cross-platform native dialogs in
 * src/window/dialogs.ts (Windows WinForms, macOS AppKit, Linux zenity/kdialog)
 * to get a real disk path from the user, then operates on it with the storage
 * facade. One API, native on every OS:
 *
 *   open     -> pickers.open + files.readBinaryFile + files.fileMeta (text preview)
 *   save     -> pickers.save  + files.writeTextFile (atomic)
 *   upload   -> pickers.open  + files.uploadFile into app private uploads
 *   download -> pickers.save  + files.downloadFile (streamed + atomic)
 *   remove   -> pickers.open  + files.removePath (missing-safe)
 *   list     -> pickers.folder    + files.listFiles
 *
 * App-managed layer (private + tmp):
 *   appSave/appLoad -> storage.put/get on samples/state.json
 *   appList         -> storage.files/directories
 *   appExport       -> generateForDownload + consumeGenerated (tmp, read-once)
 *   appDelete       -> storage.delete
 */

import { files, storage, pickers } from "@/core/facade.ts";

const TEXT_EXTS = new Set([
  "txt", "md", "json", "csv", "ts", "tsx", "js", "jsx", "html", "css",
  "log", "xml", "yml", "yaml", "toml", "ini", "env", "vue", "sql", "deno",
]);

function isTextLike(path: string): boolean {
  const ext = path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTS.has(ext);
}

function nameFromUrl(input: string): string {
  if (/^(https?|file):\/\//i.test(input)) {
    try {
      const name = decodeURIComponent(new URL(input).pathname.split("/").pop() || "");
      return name || "deskapp-download.bin";
    } catch {
      return "deskapp-download.bin";
    }
  }
  return input.split(/[\\/]/).pop() || "deskapp-download.bin";
}

/** Open any real file: native picker, then bytes + metadata (+ text preview). */
export const open = async (): Promise<Record<string, unknown>> => {
  const path = await pickers.open({ title: "Open a file" });
  if (!path) return { ok: false, error: "cancelled", action: "open" };
  try {
    const meta = await files.fileMeta(path);
    if (!meta || !meta.isFile) return { ok: false, action: "open", path, error: "not a file" };
    const bytes = await files.readBinaryFile(path);
    const preview = isTextLike(path) ? new TextDecoder().decode(bytes).slice(0, 2000) : null;
    return {
      ok: true,
      action: "open",
      path,
      size: meta.size,
      modifiedAt: meta.modifiedAt.toISOString(),
      preview,
    };
  } catch (error) {
    return { ok: false, action: "open", path, error: String(error) };
  }
};

/** Save real content with a native Save As dialog (atomic write). */
export const save = async (): Promise<Record<string, unknown>> => {
  const path = await pickers.save({
    title: "Save file as",
    defaultName: `deskapp-note-${Date.now()}.txt`,
    filter: "Text files (*.txt)|*.txt|All files (*.*)|*.*",
  });
  if (!path) return { ok: false, error: "cancelled", action: "save" };
  const content = `deskapp real save - ${new Date().toISOString()}\n`;
  try {
    await files.writeTextFile(path, content);
    const meta = await files.fileMeta(path);
    return { ok: true, action: "save", path, bytes: content.length, size: meta?.size ?? 0 };
  } catch (error) {
    return { ok: false, action: "save", path, error: String(error) };
  }
};

/** Upload (import) a real source file into the app's private store. */
export const upload = async (): Promise<Record<string, unknown>> => {
  const source = await pickers.open({ title: "Choose a file to upload" });
  if (!source) return { ok: false, error: "cancelled", action: "upload" };
  try {
    const destDir = storage.disk("private").path("uploads");
    const dest = await files.uploadFile(source, destDir);
    const meta = await files.fileMeta(source);
    return { ok: true, action: "upload", source, dest, size: meta?.size ?? 0 };
  } catch (error) {
    return { ok: false, action: "upload", source, error: String(error) };
  }
};

/** Download a real URL to a real location chosen via Save As (atomic). */
export const download = async (url: string | undefined): Promise<Record<string, unknown>> => {
  const clean = (url ?? "").trim();
  if (!clean) return { ok: false, error: "enter a URL first", action: "download" };
  const dest = await pickers.save({
    title: "Save downloaded file as",
    defaultName: nameFromUrl(clean),
  });
  if (!dest) return { ok: false, error: "cancelled", action: "download" };
  try {
    await files.downloadFile(clean, dest);
    const meta = await files.fileMeta(dest);
    return { ok: true, action: "download", url: clean, dest, size: meta?.size ?? 0 };
  } catch (error) {
    return { ok: false, action: "download", url: clean, dest, error: String(error) };
  }
};

/** Remove a real file (missing-safe). */
export const remove = async (): Promise<Record<string, unknown>> => {
  const path = await pickers.open({ title: "Choose a file to remove" });
  if (!path) return { ok: false, error: "cancelled", action: "remove" };
  try {
    await files.removePath(path);
    return { ok: true, action: "remove", path, existsAfter: await files.pathExists(path) };
  } catch (error) {
    return { ok: false, action: "remove", path, error: String(error) };
  }
};

/** List the files inside a real folder chosen via the native picker. */
export const list = async (): Promise<Record<string, unknown>> => {
  const path = await pickers.folder({ title: "Choose a folder to list" });
  if (!path) return { ok: false, error: "cancelled", action: "list" };
  try {
    return { ok: true, action: "list", path, files: await files.listFiles(path) };
  } catch (error) {
    return { ok: false, action: "list", path, error: String(error) };
  }
};

/* ---------------------------------------------------------------------------
 * App-managed layer (private disk + tmp generated artifacts)
 * ------------------------------------------------------------------------ */

const STATE_FILE = "samples/state.json";

/** Save app-owned state into the private disk (storage.put). */
export const appSave = async (): Promise<Record<string, unknown>> => {
  const data = { theme: "dark", updatedAt: new Date().toISOString(), note: "app-managed private state" };
  await storage.put(STATE_FILE, JSON.stringify(data, null, 2));
  return { ok: true, action: "save (app state)", file: STATE_FILE, data };
};

/** Read app-owned state back (storage.get). */
export const appLoad = async (): Promise<Record<string, unknown>> => {
  try {
    const raw = await storage.get(STATE_FILE);
    return { ok: true, action: "read (app state)", file: STATE_FILE, content: new TextDecoder().decode(raw) || null };
  } catch (error) {
    return { ok: false, action: "read (app state)", file: STATE_FILE, error: String(error) };
  }
};

/** List the private disk contents (storage.files / storage.directories). */
export const appList = async (): Promise<Record<string, unknown>> => {
  return {
    ok: true,
    action: "list (app state)",
    disk: storage.disk("private").path("."),
    files: await storage.files(),
    directories: await storage.directories(),
  };
};

/** Generate an ephemeral export in tmp, then consume it read-once. */
export const appExport = async (): Promise<Record<string, unknown>> => {
  const file = await storage.generateForDownload({
    prefix: "report",
    extension: "csv",
    data: "name,value\nrows,2\n",
  });
  const bytes = await storage.consumeGenerated(file);
  return {
    ok: true,
    action: "generate + consume (tmp)",
    file,
    content: new TextDecoder().decode(bytes).trim(),
  };
};

/** Delete app-owned state from the private disk (storage.delete). */
export const appDelete = async (): Promise<Record<string, unknown>> => {
  await storage.delete(STATE_FILE);
  return { ok: true, action: "delete (app state)", file: STATE_FILE, existsAfter: await storage.exists(STATE_FILE) };
};

/** Handlers exposed to the frontend via the bindings registry. */
export const handlers = {
  open,
  save,
  upload,
  download,
  remove,
  list,
  appSave,
  appLoad,
  appList,
  appExport,
  appDelete,
};