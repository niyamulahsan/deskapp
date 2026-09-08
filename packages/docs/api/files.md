# `files` — user-file layer

Imported from the facade: `import { files } from "@/core/facade.ts"`.

Operate on the **user's real file system** — any absolute path the user picks. Open, save, upload, download, list, remove, read/write text and binary. See [Storage](../guide/storage).

All writes are **atomic** (temp-file + rename). All functions are platform-agnostic.

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `ensureDir` | `(path: string) => Promise<void>` | Create a directory (and parents) if missing. |
| `pathExists` | `(path: string) => Promise<boolean>` | Whether a path exists. |
| `isFile` | `(path: string) => Promise<boolean>` | Whether the path is a regular file. |
| `isDirectory` | `(path: string) => Promise<boolean>` | Whether the path is a directory. |
| `fileMeta` | `(path: string) => Promise<{ path: string; size: number; modifiedAt: Date; isFile: boolean; isDirectory: boolean } \| null>` | Stat info, or `null` when missing. |
| `listFiles` | `(path: string) => Promise<string[]>` | Absolute paths of the files in a directory (sorted, non-recursive). |
| `listDirectories` | `(path: string) => Promise<string[]>` | Absolute paths of the immediate subdirectories. |
| `readTextFile` | `(path: string) => Promise<string>` | Read a UTF-8 text file. |
| `readTextFileOr` | `(path: string, fallback: string) => Promise<string>` | Read text, or return the fallback when missing. |
| `readBinaryFile` | `(path: string) => Promise<Uint8Array>` | Read raw bytes. |
| `readJson` | `<T>(path: string, fallback: T) => Promise<T>` | Read + parse JSON, or the fallback when missing/corrupt. |
| `writeTextFile` | `(path: string, data: string) => Promise<void>` | Write UTF-8 text (atomic). |
| `writeBinaryFile` | `(path: string, data: Uint8Array) => Promise<void>` | Write raw bytes (atomic). |
| `writeFile` | `(path: string, data: string \| Uint8Array) => Promise<void>` | Write text or bytes (atomic). |
| `writeJson` | `(path: string, value: unknown) => Promise<void>` | Stringify + write JSON (atomic). |
| `copyFile` | `(from: string, to: string) => Promise<void>` | Copy a file. |
| `moveFile` | `(from: string, to: string) => Promise<void>` | Move/rename a file. |
| `removePath` | `(path: string) => Promise<void>` | Delete a file or directory **tree** (recursive); missing paths ignored. |
| `uniquePath` | `(dir: string, name: string) => Promise<string>` | A non-colliding path for `name` inside `dir`. |
| `uploadFile` | `(source: string, destDir: string) => Promise<string>` | Copy a source file into a folder (de-duplicates the name), returns the new path. |
| `downloadFile` | `(source: string, destPath: string) => Promise<string>` | Download an `http(s)`/`file://` URL or copy a local path to a destination (atomic). |

## Use cases

### Import: pick + read a user file

`pickers.open` hands back a path; read it, then process.

```ts
import { files, pickers } from "@/core/facade.ts";

const file = await pickers.open({ title: "Open a file" });
if (!file) return;
const text = await files.readTextFile(file);
```

### Export / save with an atomic overwrite

Writes never corrupt an existing file (temp-file + rename) — safe for frequent saves.

```ts
const dest = await pickers.save({ title: "Save report", defaultName: "report.csv" });
if (dest) await files.writeTextFile(dest, csv);
```

### Read + merge JSON config

`readJson` tolerates a missing/corrupt file via the fallback; `writeJson` round-trips typed state.

```ts
const cfg = await files.readJson("/home/user/app.json", { theme: "light" });
await files.writeJson("/home/user/app.json", { ...cfg, theme: "dark" });
```

### Organize user files (copy / move / delete, no collisions)

`uniquePath` gives a safe target name; `moveFile`/`copyFile`/`removePath` complete the job.

```ts
const target = await files.uniquePath(dir, "photo.png"); // appends (1), (2)... if taken
await files.copyFile(src, target);                       // or moveFile
await files.removePath(oldPath);                         // delete when done
```

### Batch a whole folder

List files, then stat each one for metadata.

```ts
const dir = await pickers.folder({ title: "Choose a folder" });
if (dir) {
  for (const p of await files.listFiles(dir)) {
    const meta = await files.fileMeta(p);
    if (meta && meta.size > 0) await processFile(meta.path);
  }
}
```

### Download a remote file to disk

`downloadFile` accepts `http(s)://`, `file://`, or a local path — atomic write at the destination.

```ts
const saved = await files.downloadFile("https://example.com/photo.png", "./photos/photo.png");
```

### Backup / duplicate a project folder

`ensureDir` seeds the destination, then copy each entry.

```ts
await files.ensureDir(backupDir);
for (const p of await files.listFiles(projectDir)) {
  await files.copyFile(p, `${backupDir}/${new URL(`file://${p}`).pathname.split("/").pop()}`);
}
```

## Notes

- Typical pattern: open a native picker ([`pickers`](./pickers)), operate on the path, and surface the outcome to the UI through a controller + binding.

Read helpers (`readTextFileOr`, `readJson`, `fileMeta`) return fallbacks/`null` instead of throwing on missing files; write helpers create parent folders automatically.
- For the app's **own** state, use [`storage`](./storage) instead.

## Related

- [pickers](./pickers) · [storage](./storage)