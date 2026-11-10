import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { appBaseDir } from "@/core/env";

function getElectronApp(): { getPath: (name: string) => string; isPackaged: boolean } | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const e = (typeof require !== "undefined" ? require : createRequire(process.cwd() + "/"))("electron") as any;
    if (e && typeof e.app?.getPath === "function") return e.app;
  } catch {}
  return undefined;
}

type Disk = "private" | "tmp";
type FileData = string | Uint8Array | ArrayBuffer | Blob | File;

// ---------------------------------------------------------------------------
// 1) USER-FILE LAYER
// ---------------------------------------------------------------------------

async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function fileMeta(path: string) {
  try {
    const info = await fs.stat(path);
    return {
      path,
      size: info.size,
      modifiedAt: info.mtime ?? new Date(0),
      isFile: info.isFile(),
      isDirectory: info.isDirectory()
    };
  } catch {
    return null;
  }
}

async function listFiles(path: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) files.push(join(path, entry.name));
    }
  } catch {}
  return files.sort();
}

async function listDirectories(path: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    const entries = await fs.readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) dirs.push(join(path, entry.name));
    }
  } catch {}
  return dirs.sort();
}

function readTextFile(path: string): Promise<string> {
  return fs.readFile(path, "utf-8");
}

async function readTextFileOr(path: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf-8");
  } catch {
    return fallback;
  }
}

function readBinaryFile(path: string): Promise<Buffer> {
  return fs.readFile(path);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

async function writeTextFile(path: string, data: string): Promise<void> {
  await writeFileAtomic(path, data);
}

async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  await writeFileAtomic(path, data);
}

async function writeFile(path: string, data: string | Uint8Array): Promise<void> {
  await writeFileAtomic(path, data);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmp, data);
    await renameReplacing(tmp, path);
  } catch (error) {
    await fs.unlink(tmp).catch(() => {});
    throw error;
  }
}

async function copyFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to));
  await fs.copyFile(from, to);
}

async function moveFile(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to));
  await renameReplacing(from, to);
}

async function removePath(path: string): Promise<void> {
  try {
    await fs.rm(path, { recursive: true, force: true });
  } catch {}
}

async function uniquePath(dir: string, name: string): Promise<string> {
  const candidate = join(dir, name);
  if (!(await pathExists(candidate))) return candidate;
  const ext = basename(name).match(/\.(.*)$/)?.[0] ?? "";
  const stem = basename(name).slice(0, basename(name).length - ext.length);
  for (let i = 1; ; i++) {
    const next = join(dir, `${stem} (${i})${ext}`);
    if (!(await pathExists(next))) return next;
  }
}

async function uploadFile(source: string, destDir: string): Promise<string> {
  await ensureDir(destDir);
  const dest = await uniquePath(destDir, basename(source));
  await fs.copyFile(source, dest);
  return dest;
}

async function downloadFile(source: string, destPath: string): Promise<string> {
  const src = normalizeSource(source);
  await ensureDir(dirname(destPath));
  const tmp = `${destPath}.${crypto.randomUUID()}.tmp`;
  try {
    if (src.kind === "network") {
      const res = await fetch(src.value);
      if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      await fs.writeFile(tmp, Buffer.from(arrayBuffer));
    } else {
      await fs.copyFile(src.value, tmp);
    }
    await renameReplacing(tmp, destPath);
  } catch (error) {
    await fs.unlink(tmp).catch(() => {});
    throw error;
  }
  return destPath;
}

type LocalSource = { kind: "network"; value: string } | { kind: "file"; value: string };

function normalizeSource(source: string): LocalSource {
  const trimmed = source.trim();
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return { kind: "file", value: trimmed };
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme === "http" || scheme === "https") return { kind: "network", value: trimmed };
  if (scheme === "file") {
    return { kind: "file", value: new URL(trimmed).pathname };
  }
  if (scheme === undefined) return { kind: "file", value: trimmed };
  throw new Error(`Url scheme '${scheme}' not supported`);
}

async function renameReplacing(from: string, to: string): Promise<void> {
  try {
    await fs.rename(from, to);
  } catch {
    await fs.unlink(to).catch(() => {});
    await fs.rename(from, to);
  }
}

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
  downloadFile
};

// ---------------------------------------------------------------------------
// 2) APP-MANAGED LAYER
// ---------------------------------------------------------------------------

const driver = "local";
const defaultDisk: Disk = "private";

let appRootCache: string | null = null;
function appRoot(): string {
  if (appRootCache) return appRootCache;
  if (process.env.APP_DATA_DIR) {
    appRootCache = resolve(process.env.APP_DATA_DIR);
    return appRootCache;
  }
  const electronApp = getElectronApp();
  if (electronApp) {
    // Writable per-user data dir (works in dev and packaged installs, incl. Program Files).
    appRootCache = join(electronApp.getPath("userData"), "storage");
    return appRootCache;
  }
  // CLI/dev fallback: project-local storage.
  appRootCache = join(appBaseDir(), "src", "storage", "app");
  return appRootCache;
}

const disks: Record<Disk, () => string> = {
  private: () => join(appRoot(), "private"),
  tmp: () => join(appRoot(), "tmp")
};

function clean(input: string): string {
  const value = input.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!value || value.includes("..")) throw new Error("Invalid storage path");
  return value;
}

function diskAbs(disk: Disk, file: string): string {
  return join(disks[disk](), clean(file));
}

async function diskToBuffer(data: FileData): Promise<Buffer> {
  if (typeof data === "string") return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data instanceof Blob) return Buffer.from(await data.arrayBuffer());
  return Buffer.from([]);
}

async function diskPut(disk: Disk, file: string, data: FileData): Promise<string> {
  const filePath = diskAbs(disk, file);
  await fs.mkdir(dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, await diskToBuffer(data));
  return clean(file);
}

async function diskPutFile(disk: Disk, directory: string, file: File, name?: string): Promise<string> {
  const finalName = name || `${Date.now()}-${crypto.randomUUID()}-${file.name}`;
  return await diskPut(disk, join(clean(directory), finalName), file);
}

async function diskWriteGeneratedTemp(prefix: string, extension: string, data: FileData): Promise<string> {
  const safePrefix = clean(prefix).replace(/\//g, "-");
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "tmp";
  const fileName = `${Date.now()}-${crypto.randomUUID()}-${safePrefix}.${safeExtension}`;
  const file = join("generated", fileName);
  await diskPut("tmp", file, data);
  return file;
}

async function diskConsumeGeneratedTemp(file: string): Promise<Buffer> {
  const target = diskAbs("tmp", clean(file));
  const content = await fs.readFile(target);
  try {
    await fs.unlink(target);
  } catch {}
  return content;
}

async function diskExists(disk: Disk, file: string): Promise<boolean> {
  try {
    await fs.stat(diskAbs(disk, file));
    return true;
  } catch {
    return false;
  }
}

async function diskRemove(disk: Disk, file: string): Promise<void> {
  try {
    await fs.unlink(diskAbs(disk, file));
  } catch {}
}

function diskRead(disk: Disk, file: string): Promise<Buffer> {
  return fs.readFile(diskAbs(disk, file));
}

async function diskCopy(disk: Disk, from: string, to: string): Promise<string> {
  await fs.mkdir(dirname(diskAbs(disk, to)), { recursive: true });
  await fs.copyFile(diskAbs(disk, from), diskAbs(disk, to));
  return clean(to);
}

async function diskMove(disk: Disk, from: string, to: string): Promise<string> {
  await fs.mkdir(dirname(diskAbs(disk, to)), { recursive: true });
  await fs.rename(diskAbs(disk, from), diskAbs(disk, to));
  return clean(to);
}

async function diskMetadata(disk: Disk, file: string) {
  const stat = await fs.stat(diskAbs(disk, file));
  return {
    size: stat.size,
    mimeType: "application/octet-stream",
    lastModified: stat.mtime.getTime()
  };
}

function diskFileUrl(disk: Disk, file: string): string {
  return pathToFileURL(diskAbs(disk, file)).href;
}

async function diskReadStream(disk: Disk, file: string): Promise<ReadableStream<Uint8Array>> {
  const bytes = await fs.readFile(diskAbs(disk, file));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    }
  });
}

async function diskWriteStream(disk: Disk, file: string, stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return await diskPut(disk, file, out);
}

async function diskMakeDirectory(disk: Disk, directory: string): Promise<string> {
  const dir = clean(directory);
  await fs.mkdir(diskAbs(disk, dir), { recursive: true });
  return dir;
}

async function diskDeleteDirectory(disk: Disk, directory: string): Promise<void> {
  try {
    await fs.rm(diskAbs(disk, directory), { recursive: true, force: true });
  } catch {}
}

async function diskListFiles(disk: Disk, directory = ""): Promise<string[]> {
  const dir = clean(directory || "root").replace(/^root$/, "");
  const files: string[] = [];
  try {
    const entries = await fs.readdir(diskAbs(disk, dir || "."), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) files.push(dir ? `${dir}/${entry.name}` : entry.name);
    }
  } catch {}
  return files;
}

async function diskListDirectories(disk: Disk, directory = ""): Promise<string[]> {
  const dir = directory.trim() ? clean(directory) : "";
  const dirs: string[] = [];
  try {
    const entries = await fs.readdir(diskAbs(disk, dir || "."), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) dirs.push(dir ? `${dir}/${entry.name}` : entry.name);
    }
  } catch {}
  return dirs;
}

export interface StorageDisk {
  put(file: string, data: FileData): Promise<string>;
  putFile(directory: string, file: File, name?: string): Promise<string>;
  get(file: string): Promise<Buffer>;
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
    writeStream: (file: string, stream: ReadableStream<Uint8Array>) => diskWriteStream(disk, file, stream),
    temporaryUrl: (file: string) => diskFileUrl(disk, file),
    path: (file: string) => diskAbs(disk, file),
    url: (file: string) => diskFileUrl(disk, file)
  };
}

export interface StorageFacade {
  init(): Promise<void>;
  driver: string;
  defaultDisk: Disk;
  disk(disk: Disk): StorageDisk;
  put(file: string, data: FileData): Promise<string>;
  putFile(directory: string, file: File, name?: string): Promise<string>;
  get(file: string): Promise<Buffer>;
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
  consumeGenerated(file: string): Promise<Buffer>;
}

export const storage: StorageFacade = {
  async init() {
    await Promise.all(["private", "tmp"].map((d) => fs.mkdir(disks[d as Disk](), { recursive: true })));
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

  async download(_c: unknown, file: string, filename?: string) {
    const bytes = await diskRead(defaultDisk, file);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename=${filename || clean(file).split("/").pop()}`
      }
    });
  },

  async generateForDownload(options: { prefix: string; extension: string; data: FileData }) {
    return await diskWriteGeneratedTemp(options.prefix, options.extension, options.data);
  },

  async consumeGenerated(file: string) {
    return await diskConsumeGeneratedTemp(file);
  }
};

export type { Disk, FileData };
