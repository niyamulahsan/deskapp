# Storage

Storage is two in-process layers: the **user-file layer** (`files`, plus the native `pickers`) operates on any path the user picks; the **app-managed layer** (`storage`) holds the app's own internal state.

## Layer 1 — user-file operations

Unlimited operations on the user's real filesystem: open/save/upload/download, list, remove, read/write text and binary.

| Facade function | Purpose |
| --- | --- |
| `pickers.open(...)` / `pickers.save(...)` / `pickers.folder(...)` | native pickers — see [Windows](./windows.md#file-pickers) |
| `files.readTextFile(path)` / `files.readTextFileOr(path, fallback)` / `files.readBinaryFile(path)` | read file contents (reject when missing, or fallback-safe) |
| `files.readJson(path, fallback)` | parse JSON, falling back when missing/malformed |
| `files.writeTextFile(path, text)` / `files.writeBinaryFile(path, bytes)` / `files.writeJson(path, value)` | atomic write (temp file + rename) |
| `files.uploadFile(source, destDir)` | copy into a folder, keeping the name, deduped (` (1)`, ` (2)`…); returns the new path |
| `files.downloadFile(source, destPath)` | stream http(s)/`file://` URL or local path to a file, atomically; returns `destPath` |
| `files.fileMeta(path)` | `{ path, size, modifiedAt, isFile, isDirectory }` or `null` |
| `files.listFiles(path)` | sorted **absolute file paths** (non-recursive) |
| `files.listDirectories(path)` | sorted absolute directory paths (non-recursive) |
| `files.removePath(path)` | delete a file or directory tree (missing-safe) |
| `files.copyFile(from, to)` / `files.moveFile(from, to)` | duplicate / move (overwrites existing target) |
| `files.pathExists(path)` / `files.isFile(path)` / `files.isDirectory(path)` | existence / type checks |
| `files.ensureDir(path)` / `files.uniquePath(dir, name)` | create folders / dedupe a candidate name |

To expose any of these to the UI, wrap them in a controller + binding (`<module>.<controller>.<handler>`) — e.g. handlers for `open`/`save`/`upload`/`download`/`remove`/`list` on user-picked files, and `appSave`/`appLoad`/`appList`/`appExport`/`appDelete` on the app-managed area.

## Layer 2 — app-managed area

Framework-managed `private`/`tmp` disks with atomic writes, rooted at `src/storage/app/` (configurable via `APP_DATA_DIR`; gitignored):

```
src/storage/
  app/     app private data (survives restarts)
  tmp/     temporary files
  deskapp.sqlite   the database
```

`storage.init()` creates the disk folders at boot. Top-level `storage.*` methods act on the default disk (`private`); scope explicitly with `storage.disk("private" | "tmp")`. A `StorageDisk` wraps every operation with safe path resolution (relative keys; `..` or leading slashes are rejected) and — for writes — atomic tmp-file-and-rename semantics:

| Member | Purpose |
| --- | --- |
| `disk.put(file, data)` | write `FileData` (string / bytes / `Blob` / `File`); returns the clean key |
| `disk.get(file)` | read the file's bytes |
| `disk.delete(file)` / `disk.exists(file)` / `disk.missing(file)` | mutate / inspect (missing-safe) |
| `disk.files(directory?)` / `disk.directories(directory?)` | list relative keys, non-recursive |
| `disk.copy(from, to)` / `disk.move(from, to)` | duplicate / rename within the disk |
| `disk.url(file)` / `disk.temporaryUrl(file)` / `disk.download(c, file, name?)` | `file://` URL / download response |
| `disk.path(file)` | the absolute filesystem path |

Plus `generateForDownload({ prefix, extension, data })` / `consumeGenerated(file)` for ephemeral tmp exports written read-once.

## Example

```ts
import { files, storage } from "@/core/facade.ts";

// user picks a file; the app saves atomically
await files.writeTextFile("/home/user/notes.txt", "hello");
const meta = await files.fileMeta("/home/user/notes.txt");   // { path, size, modifiedAt, isFile, isDirectory }

// app-managed JSON state on the default (private) disk
await storage.put("settings.json", JSON.stringify({ theme: "dark" }));
const saved: Uint8Array = await storage.get("settings.json");

// a generated artifact in tmp, consumed once
const file = await storage.generateForDownload({ prefix: "report", extension: "csv", data: "a,b\n1,2\n" });
const bytes = await storage.consumeGenerated(file);
```

## Security notes

- App-disk helpers reject any relative key containing `..` or a leading slash — nothing escapes the disk root.
- `listFiles` / `listDirectories` are non-recursive; `removePath` can delete a tree only when you explicitly pass it the tree root.