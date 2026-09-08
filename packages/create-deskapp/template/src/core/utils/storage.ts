/**
 * storage.ts - desktop file/storage utilities (two layers).
 *
 * 1) USER-FILE LAYER (unbounded paths): on desktop the user owns the whole
 *    machine, so open/save/upload/download/remove work on ANY absolute path
 *    the user picks. Exposed on the `files` facade object:
 *      open:     files.readTextFile, readBinaryFile, readJson
 *      save:     files.writeTextFile, writeBinaryFile, writeJson   (atomic)
 *      upload:   files.uploadFile(src, destDir)                    (copy + dedupe)
 *      download: files.downloadFile(src, destPath)  (http(s) URL, file:// URL,
 *                                                  or local path -> file, atomic)
 *      remove:   files.removePath
 *      plus:     ensureDir, pathExists, isFile, isDirectory, fileMeta,
 *                listFiles, listDirectories, copyFile, moveFile, uniquePath
 *
 * 2) APP-MANAGED LAYER (slim, engine-style): the app's OWN internal state
 *    (settings, queue data, generated artifacts) lives in its own space, NOT
 *    the user's files. Two disks — there is no "public" disk, that was a
 *    web/URL concept:
 *      private: app-internal state    (root: src/storage/app/private)
 *      tmp:     transient artifacts   (root: src/storage/app/tmp)
 *    Exposed as the `storage` facade (functional, disk-scoped), the same API
 *    shape as the engine's storage minus the public disk and S3.
 *
 * The APP_DATA_DIR env var redirects the app-managed root (a packaged build
 * can point it at the OS user-data dir).
 */

import { dirname, fromFileUrl, join, resolve, toFileUrl } from "@std/path";
import { basename as posixBasename, join as posixJoin } from "@std/path/posix";

type Disk = "private" | "tmp";
type FileData = string | Uint8Array | ArrayBuffer | Blob | File;

// ---------------------------------------------------------------------------
// 1) USER-FILE LAYER — any path on the user's machine
// ---------------------------------------------------------------------------

/** Recursively create a directory (no-op when it already exists). */
async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

/** True when the path exists. */
async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/** True when the path is a regular file. */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch {
    return false;
  }
}

/** True when the path is a directory. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isDirectory;
  } catch {
    return false;
  }
}

/** Metadata for a path. `null` when missing. */
async function fileMeta(
  path: string,
): Promise<{ path: string; size: number; modifiedAt: Date; isFile: boolean; isDirectory: boolean } | null> {
  try {
    const info = await Deno.stat(path);
    return {
      path,
      size: info.size,
      modifiedAt: info.mtime ?? new Date(0),
      isFile: info.isFile,
      isDirectory: info.isDirectory,
    };
  } catch {
    return null;
  }
}

/** Absolute paths of the files inside a directory (sorted, non-recursive). */
async function listFiles(path: string): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isFile) files.push(join(path, entry.name));
    }
  } catch {
    // directory does not exist
  }
  return files.sort();
}

/** Absolute paths of the directories inside a directory (sorted). */
async function listDirectories(path: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory) dirs.push(join(path, entry.name));
    }
  } catch {
    // directory does not exist
  }
  return dirs.sort();
}

/** Open a file as UTF-8 text. Rejects when missing. */
function readTextFile(path: string): Promise<string> {
  return Deno.readTextFile(path);
}

/** Open a file as text, or `fallback` when missing. */
async function readTextFileOr(path: string, fallback: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return fallback;
  }
}

/** Open a file as raw bytes. Rejects when missing. */
function readBinaryFile(path: string): Promise<Uint8Array> {
  return Deno.readFile(path);
}

/** Open and parse a JSON file, or `fallback` when missing/malformed. */
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as T;
  } catch {
    return fallback;
  }
}

/** Save text atomically (temp file + rename, so crashes never corrupt). */
async function writeTextFile(path: string, data: string): Promise<void> {
  await writeFileAtomic(path, data);
}

/** Save bytes atomically. */
async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  await writeFileAtomic(path, data);
}

/** Save string or binary data atomically. */
async function writeFile(path: string, data: string | Uint8Array): Promise<void> {
  await writeFileAtomic(path, data);
}

/** Serialize and save JSON atomically (pretty-printed). */
async function writeJson(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Write to a temp file in the same folder, then move into place. */
async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    if (typeof data === "string") {
      await Deno.writeTextFile(tmp, data);
    } else {
      await Deno.writeFile(tmp, data);
    }
    await renameReplacing(tmp, path);
  } catch (error) {
    await Deno.remove(tmp).catch(() => {});
    throw error;
  }
}

/** Copy a file (or tree) to a new location, overwriting existing targets. */
async function copyFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to));
  await Deno.copyFile(from, to);
}

/** Move/rename a file or directory to a new location. */
async function moveFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to));
  await renameReplacing(from, to);
}

/** Remove a file or directory tree. Missing paths are ignored. */
async function removePath(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // path does not exist; nothing to remove
  }
}

/** A path inside `dir` with `name`, deduplicated (` (1)`, ` (2)`...). */
async function uniquePath(dir: string, name: string): Promise<string> {
  const candidate = join(dir, name);
  if (!(await pathExists(candidate))) return candidate;
  const ext = basenameExt(name);
  const stem = removeExt(name);
  for (let i = 1; ; i++) {
    const next = join(dir, `${stem} (${i})${ext}`);
    if (!(await pathExists(next))) return next;
  }
}

/**
 * Upload (import) a file into the user's chosen folder. Copies `source` into
 * `destDir` keeping its basename, deduping if needed. Returns the new path.
 */
async function uploadFile(source: string, destDir: string): Promise<string> {
  await ensureDir(destDir);
  const dest = await uniquePath(destDir, basenameOf(source));
  await Deno.copyFile(source, dest);
  return dest;
}

/**
 * Download to the user's chosen destination path, streaming to a temp file
 * then moving into place. Returns `destPath`.
 *
 * The source can be any of:
 *   - an http(s) URL   (streamed via fetch)
 *   - a file:// URL    (copied from a local file)
 *   - a plain absolute local path   (copied from a local file)
 */
async function downloadFile(source: string, destPath: string): Promise<string> {
  const src = normalizeSource(source);
  await ensureDir(dirname(destPath));
  const tmp = `${destPath}.${crypto.randomUUID()}.tmp`;
  try {
    if (src.kind === "network") {
      const res = await fetch(src.value);
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      if (res.body) {
        const file = await Deno.open(tmp, { write: true, create: true, truncate: true });
        await res.body.pipeTo(file.writable);
      } else {
        await Deno.writeFile(tmp, new Uint8Array(await res.arrayBuffer()));
      }
    } else {
      await Deno.copyFile(src.value, tmp);
    }
    await renameReplacing(tmp, destPath);
  } catch (error) {
    await Deno.remove(tmp).catch(() => {});
    throw error;
  }
  return destPath;
}

/**
 * Decide how `downloadFile` should fetch `source`: a network http(s) URL, or a
 * local file given either as a file:// URL or a plain absolute path.
 */
type LocalSource =
  | { kind: "network"; value: string }
  | { kind: "file"; value: string };

function normalizeSource(source: string): LocalSource {
  const trimmed = source.trim();
  // Windows absolute path (C:\... or C:/...) - NOT a URI scheme
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return { kind: "file", value: trimmed };
  }
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme === "http" || scheme === "https") {
    return { kind: "network", value: trimmed };
  }
  if (scheme === "file") {
    return { kind: "file", value: fromFileUrl(trimmed) };
  }
  if (scheme === undefined) {
    // relative path, UNC path (\\server\...), or POSIX absolute path
    return { kind: "file", value: trimmed };
  }
  throw new Error(`Url scheme '${scheme}' not supported`);
}

/** Extension (with dot) of a filename. */
function basenameExt(file: string): string {
  const name = basenameOf(file);
  return name.match(/\.(.*)$/)?.[0] ?? "";
}

/** Filename without its extension. */
function removeExt(file: string): string {
  const name = basenameOf(file);
  const ext = basenameExt(file);
  return name.slice(0, name.length - ext.length);
}

/** Platform basename of a path. */
function basenameOf(file: string): string {
  return file.split(/[\\/]/).pop() || file;
}

/** Move `from` onto `to`, overwriting an existing destination. */
async function renameReplacing(from: string, to: string): Promise<void> {
  try {
    await Deno.rename(from, to);
  } catch {
    await Deno.remove(to).catch(() => {});
    await Deno.rename(from, to);
  }
}

/**
 * files - user-file layer facade. Operates on ANY path the user picks on the
 * desktop (open/save/upload/download/remove/list/stat). Access through the
 * facade: `import { files } from "@/core/facade.ts"`.
 */
export const files = {
  ensureDir,
  pathExists,
  isFile,
  isDirectory,
  fileMeta,
  listFiles,
  listDirectories,
  readTextFile,
  readTextFileOr,
  readBinaryFile,
  readJson,
  writeTextFile,
  writeBinaryFile,
  writeFile,
  writeJson,
  copyFile,
  moveFile,
  removePath,
  uniquePath,
  uploadFile,
  downloadFile,
};

// ---------------------------------------------------------------------------
// 2) APP-MANAGED LAYER — the app's own internal state (private + tmp)
// ---------------------------------------------------------------------------

const driver = "local";
const defaultDisk: Disk = "private";

const appRoot = Deno.env.get("APP_DATA_DIR")
  ? resolve(Deno.env.get("APP_DATA_DIR")!)
  : resolve(Deno.cwd(), "src", "storage", "app");

const disks: Record<Disk, string> = {
  private: join(appRoot, "private"),
  tmp: join(appRoot, "tmp"),
};

/** Normalize a relative storage key: forward slashes, no traversal. */
function clean(input: string): string {
  const value = input.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!value || value.includes("..")) throw new Error("Invalid storage path");
  return value;
}

/** Absolute filesystem path for a file on a disk. */
function diskAbs(disk: Disk, file: string): string {
  return join(disks[disk], clean(file));
}

/** Normalize heterogeneous payloads to bytes. */
async function diskToBuffer(data: FileData): Promise<Uint8Array> {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return new Uint8Array();
}

/** Write bytes to a disk, creating the parent folder. */
async function diskPut(disk: Disk, file: string, data: FileData): Promise<string> {
  const filePath = diskAbs(disk, file);
  await Deno.mkdir(dirname(filePath), { recursive: true });
  await Deno.writeFile(filePath, await diskToBuffer(data));
  return clean(file);
}

/** Store a browser-style `File` with a deterministic name. */
async function diskPutFile(disk: Disk, directory: string, file: File, name?: string): Promise<string> {
  const finalName = name || `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
  return await diskPut(disk, posixJoin(clean(directory), finalName), file);
}

/** Persist a generated artifact (export/download prep) in tmp storage. */
async function diskWriteGeneratedTemp(
  prefix: string,
  extension: string,
  data: FileData,
): Promise<string> {
  const safePrefix = clean(prefix).replace(/\//g, "-");
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "tmp";
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safePrefix}.${safeExtension}`;
  const file = posixJoin("generated", fileName);
  await diskPut("tmp", file, data);
  return file;
}

/** Read a generated tmp file, then remove it (read-once semantics). */
async function diskConsumeGeneratedTemp(file: string): Promise<Uint8Array> {
  const target = diskAbs("tmp", clean(file));
  const content = await Deno.readFile(target);
  try {
    await Deno.remove(target);
  } catch {
    // already gone; nothing to clean up
  }
  return content;
}

/** Whether a file exists on a disk. */
async function diskExists(disk: Disk, file: string): Promise<boolean> {
  try {
    await Deno.stat(diskAbs(disk, file));
    return true;
  } catch {
    return false;
  }
}

/** Delete a single file from a disk. Missing files are ignored. */
async function diskRemove(disk: Disk, file: string): Promise<void> {
  try {
    await Deno.remove(diskAbs(disk, file));
  } catch {
    // file does not exist; nothing to remove
  }
}

/** Read a file's full bytes from a disk. */
function diskRead(disk: Disk, file: string): Promise<Uint8Array> {
  return Deno.readFile(diskAbs(disk, file));
}

/** Duplicate a file within the same disk. */
async function diskCopy(disk: Disk, from: string, to: string): Promise<string> {
  await Deno.mkdir(dirname(diskAbs(disk, to)), { recursive: true });
  await Deno.copyFile(diskAbs(disk, from), diskAbs(disk, to));
  return clean(to);
}

/** Move/rename a file within the same disk. */
async function diskMove(disk: Disk, from: string, to: string): Promise<string> {
  await Deno.mkdir(dirname(diskAbs(disk, to)), { recursive: true });
  await Deno.rename(diskAbs(disk, from), diskAbs(disk, to));
  return clean(to);
}

/** Size, MIME, and modification time for a stored file. */
async function diskMetadata(disk: Disk, file: string) {
  const stat = await Deno.stat(diskAbs(disk, file));
  return {
    size: stat.size,
    mimeType: "application/octet-stream",
    lastModified: stat.mtime ? stat.mtime.getTime() : 0,
  };
}

/** Direct URL for a stored file (file:// for the local driver). */
function diskFileUrl(disk: Disk, file: string): string {
  return toFileUrl(diskAbs(disk, file)).href;
}

/** Stream a file's bytes out (local driver buffers then streams). */
async function diskReadStream(disk: Disk, file: string): Promise<ReadableStream<Uint8Array>> {
  const bytes = await Deno.readFile(diskAbs(disk, file));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Drain a stream into a stored file. */
async function diskWriteStream(
  disk: Disk,
  file: string,
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return await diskPut(disk, file, out);
}

/** Ensure a directory exists on a disk. */
async function diskMakeDirectory(disk: Disk, directory: string): Promise<string> {
  const dir = clean(directory);
  await Deno.mkdir(diskAbs(disk, dir), { recursive: true });
  return dir;
}

/** Delete a directory tree from a disk. */
async function diskDeleteDirectory(disk: Disk, directory: string): Promise<void> {
  try {
    await Deno.remove(diskAbs(disk, directory), { recursive: true });
  } catch {
    // directory does not exist; nothing to remove
  }
}

/** List flat file paths in a disk directory (relative, non-recursive). */
async function diskListFiles(disk: Disk, directory = ""): Promise<string[]> {
  const dir = clean(directory || "root").replace(/^root$/, "");
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(diskAbs(disk, dir || "."))) {
      if (entry.isFile) files.push(dir ? `${dir}/${entry.name}` : entry.name);
    }
  } catch {
    // directory does not exist
  }
  return files;
}

/** List immediate child directory names in a disk directory. */
async function diskListDirectories(disk: Disk, directory = ""): Promise<string[]> {
  const dir = directory.trim() ? clean(directory) : "";
  const dirs: string[] = [];
  try {
    for await (const entry of Deno.readDir(diskAbs(disk, dir || "."))) {
      if (entry.isDirectory) dirs.push(dir ? `${dir}/${entry.name}` : entry.name);
    }
  } catch {
    // directory does not exist
  }
  return dirs;
}

/** A disk-scoped storage handle (engine `storage.disk(...)` shape). */
export interface StorageDisk {
  put(file: string, data: FileData): Promise<string>;
  putFile(directory: string, file: File, name?: string): Promise<string>;
  get(file: string): Promise<Uint8Array>;
  delete(file: string): Promise<void>;
  copy(from: string, to: string): Promise<string>;
  move(from: string, to: string): Promise<string>;
  exists(file: string): Promise<boolean>;
  missing(file: string): Promise<boolean>;
  size(file: string): Promise<number>;
  mimeType(file: string): Promise<string>;
  lastModified(file: string): Promise<number>;
  files(directory?: string): Promise<string[]>;
  directories(directory?: string): Promise<string[]>;
  makeDirectory(directory: string): Promise<string>;
  deleteDirectory(directory: string): Promise<void>;
  readStream(file: string): Promise<ReadableStream<Uint8Array>>;
  writeStream(file: string, stream: ReadableStream<Uint8Array>): Promise<string>;
  temporaryUrl(file: string): string;
  path(file: string): string;
  url(file: string): string;
}

function disk(disk: Disk): StorageDisk {
  return {
    put: (file: string, data: FileData) => diskPut(disk, file, data),
    putFile: (directory: string, file: File, name?: string) => diskPutFile(disk, directory, file, name),
    get: (file: string) => diskRead(disk, file),
    delete: (file: string) => diskRemove(disk, file),
    copy: (from: string, to: string) => diskCopy(disk, from, to),
    move: (from: string, to: string) => diskMove(disk, from, to),
    exists: (file: string) => diskExists(disk, file),
    missing: async (file: string) => !(await diskExists(disk, file)),
    size: async (file: string) => (await diskMetadata(disk, file)).size,
    mimeType: async (file: string) => (await diskMetadata(disk, file)).mimeType,
    lastModified: async (file: string) => (await diskMetadata(disk, file)).lastModified,
    files: (directory = "") => diskListFiles(disk, directory),
    directories: (directory = "") => diskListDirectories(disk, directory),
    makeDirectory: (directory: string) => diskMakeDirectory(disk, directory),
    deleteDirectory: (directory: string) => diskDeleteDirectory(disk, directory),
    readStream: (file: string) => diskReadStream(disk, file),
    writeStream: (file: string, stream: ReadableStream<Uint8Array>) =>
      diskWriteStream(disk, file, stream),
    temporaryUrl: (file: string) => diskFileUrl(disk, file),
    path: (file: string) => diskAbs(disk, file),
    url: (file: string) => diskFileUrl(disk, file),
  };
}

/**
 * App-managed storage facade. Top-level methods operate on the default disk
 * (`private`); scope explicitly with `storage.disk("tmp")`.
 */
export interface StorageFacade {
  /** Create the configured disk directories (called at boot). */
  init(): Promise<void>;
  driver: string;
  defaultDisk: Disk;
  disk(disk: Disk): StorageDisk;
  put(file: string, data: FileData): Promise<string>;
  putFile(directory: string, file: File, name?: string): Promise<string>;
  get(file: string): Promise<Uint8Array>;
  delete(file: string): Promise<void>;
  copy(from: string, to: string): Promise<string>;
  move(from: string, to: string): Promise<string>;
  exists(file: string): Promise<boolean>;
  missing(file: string): Promise<boolean>;
  size(file: string): Promise<number>;
  mime(file: string): Promise<string>;
  mimeType(file: string): Promise<string>;
  lastModified(file: string): Promise<number>;
  files(directory?: string): Promise<string[]>;
  directories(directory?: string): Promise<string[]>;
  makeDirectory(directory: string): Promise<string>;
  deleteDirectory(directory: string): Promise<void>;
  readStream(file: string): Promise<ReadableStream<Uint8Array>>;
  writeStream(file: string, stream: ReadableStream<Uint8Array>): Promise<string>;
  url(file: string): string;
  temporaryUrl(file: string): string;
  download(c: unknown, file: string, filename?: string): Promise<Response>;
  generateForDownload(options: { prefix: string; extension: string; data: FileData }): Promise<string>;
  consumeGenerated(file: string): Promise<Uint8Array>;
}

export const storage: StorageFacade = {
  /** Create the configured disk directories (called at boot). */
  async init() {
    await Promise.all(
      ["private", "tmp"].map((d) => Deno.mkdir(disks[d as Disk], { recursive: true })),
    );
  },

  driver,

  defaultDisk,

  disk,

  put(file: string, data: FileData) {
    return storage.disk(defaultDisk).put(file, data);
  },

  putFile(directory: string, file: File, name?: string) {
    return storage.disk(defaultDisk).putFile(directory, file, name);
  },

  get(file: string) {
    return storage.disk(defaultDisk).get(file);
  },

  delete(file: string) {
    return storage.disk(defaultDisk).delete(file);
  },

  copy(from: string, to: string) {
    return storage.disk(defaultDisk).copy(from, to);
  },

  move(from: string, to: string) {
    return storage.disk(defaultDisk).move(from, to);
  },

  exists(file: string) {
    return storage.disk(defaultDisk).exists(file);
  },

  missing(file: string) {
    return storage.disk(defaultDisk).missing(file);
  },

  size(file: string) {
    return storage.disk(defaultDisk).size(file);
  },

  mime(file: string) {
    return storage.disk(defaultDisk).mimeType(file);
  },

  mimeType(file: string) {
    return storage.disk(defaultDisk).mimeType(file);
  },

  lastModified(file: string) {
    return storage.disk(defaultDisk).lastModified(file);
  },

  files(directory = "") {
    return storage.disk(defaultDisk).files(directory);
  },

  directories(directory = "") {
    return storage.disk(defaultDisk).directories(directory);
  },

  makeDirectory(directory: string) {
    return storage.disk(defaultDisk).makeDirectory(directory);
  },

  deleteDirectory(directory: string) {
    return storage.disk(defaultDisk).deleteDirectory(directory);
  },

  readStream(file: string) {
    return storage.disk(defaultDisk).readStream(file);
  },

  writeStream(file: string, stream: ReadableStream<Uint8Array>) {
    return storage.disk(defaultDisk).writeStream(file, stream);
  },

  url(file: string) {
    return storage.disk(defaultDisk).url(file);
  },

  temporaryUrl(file: string) {
    return storage.disk(defaultDisk).temporaryUrl(file);
  },

  /** Download response from the default disk with attachment headers. */
  async download(_c: unknown, file: string, filename?: string) {
    const bytes = await diskRead(defaultDisk, file);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(buffer, {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename=${filename || posixBasename(clean(file))}`,
      },
    });
  },

  /** Write an ephemeral generated file for a deferred download. */
  async generateForDownload(options: { prefix: string; extension: string; data: FileData }) {
    return await diskWriteGeneratedTemp(options.prefix, options.extension, options.data);
  },

  /** Read a generated tmp file once, then delete it. */
  async consumeGenerated(file: string) {
    return await diskConsumeGeneratedTemp(file);
  },
};

export type { Disk, FileData };
