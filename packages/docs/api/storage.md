# `storage` — app-managed layer

Imported from the facade: `import { storage } from "@/core/facade.ts"`.

The app's **own** internal state — settings, queue data, generated artifacts — kept out of the user's files. Two disks, rooted at `src/storage/app/` (redirect the root with the `APP_DATA_DIR` env var in packaged builds):

- `private` — app-internal state that survives restarts.
- `tmp` — transient artifacts (uploads, generated downloads).

Top-level methods operate on the default `private` disk; scope explicitly with `storage.disk("tmp")`. App-disk helpers reject any path escaping the disk root. See [Storage](../guide/storage).

## Signature

| Member | Signature | Description |
| --- | --- | --- |
| `init` | `() => Promise<void>` | Create the configured disk directories (called at boot). |
| `driver` | `string` | `"local"`. |
| `defaultDisk` | `Disk` | `"private"`. |
| `disk` | `(disk: Disk) => StorageDisk` | A disk-scoped handle. |
| `put` | `(file: string, data: FileData) => Promise<string>` | Write a file; returns the normalized key. |
| `putFile` | `(directory: string, file: File, name?: string) => Promise<string>` | Store a browser-style `File` with a deterministic name. |
| `get` | `(file: string) => Promise<Uint8Array>` | Read a file's bytes. |
| `delete` | `(file: string) => Promise<void>` | Delete a file (missing ignored). |
| `copy` | `(from: string, to: string) => Promise<string>` | Duplicate a file. |
| `move` | `(from: string, to: string) => Promise<string>` | Move/rename a file. |
| `exists` | `(file: string) => Promise<boolean>` | Whether the file exists. |
| `missing` | `(file: string) => Promise<boolean>` | Negation of `exists`. |
| `size` | `(file: string) => Promise<number>` | Byte size. |
| `mimeType` / `mime` | `(file: string) => Promise<string>` | MIME type. |
| `lastModified` | `(file: string) => Promise<number>` | Epoch ms of last modification. |
| `files` | `(directory?: string) => Promise<string[]>` | Flat file paths in a directory (relative). |
| `directories` | `(directory?: string) => Promise<string[]>` | Immediate child directory names. |
| `makeDirectory` | `(directory: string) => Promise<string>` | Ensure a directory exists. |
| `deleteDirectory` | `(directory: string) => Promise<void>` | Delete a directory tree. |
| `readStream` | `(file: string) => Promise<ReadableStream<Uint8Array>>` | Stream a file's bytes out. |
| `writeStream` | `(file: string, stream: ReadableStream<Uint8Array>) => Promise<string>` | Drain a stream into a file. |
| `url` / `temporaryUrl` | `(file: string) => string` | Direct `file://` URL for the file. |
| `download` | `(c: unknown, file: string, filename?: string) => Promise<Response>` | A `Response` with attachment headers for the file. |
| `generateForDownload` | `(o: { prefix: string; extension: string; data: FileData }) => Promise<string>` | Write an ephemeral file into tmp for a deferred download. |
| `consumeGenerated` | `(file: string) => Promise<Uint8Array>` | Read a generated tmp file once, then delete it. |

## Types

```ts
type Disk = "private" | "tmp";
type FileData = string | Uint8Array | ArrayBuffer | Blob | File;

interface StorageDisk { // from storage.disk(disk)
  put(file, data): Promise<string>; putFile(dir, file, name?): Promise<string>;
  get(file): Promise<Uint8Array>; delete(file): Promise<void>;
  copy(from, to): Promise<string>; move(from, to): Promise<string>;
  exists(file): Promise<boolean>; missing(file): Promise<boolean>;
  size(file): Promise<number>; mimeType(file): Promise<string>; lastModified(file): Promise<number>;
  files(dir?): Promise<string[]>; directories(dir?): Promise<string[]>;
  makeDirectory(dir): Promise<string>; deleteDirectory(dir): Promise<void>;
  readStream(file): Promise<ReadableStream<Uint8Array>>; writeStream(file, stream): Promise<string>;
  temporaryUrl(file): string; path(file): string; url(file): string;
}
```

## Use cases

### App settings (private disk)

Caught errors → defaults via `exists`/`get`, then one `put` to persist.

```ts
await storage.init(); // once at boot

const raw = storage.exists("settings.json") ? await storage.get("settings.json") : null;
const settings = raw ? JSON.parse(new TextDecoder().decode(raw)) : { theme: "light" };

settings.theme = "dark";
await storage.put("settings.json", JSON.stringify(settings));
```

### Storing a webview-uploaded `File`

The UI hands over a browser `File`; `putFile` names it deterministically and returns the key.

```ts
// Vue: const file = event.target.files[0]
const key = await storage.putFile("avatars", file);          // avatars/<timestamp>-<uuid>-<name>
const url = storage.url(key);                                // file:// the <img> can load
```

### Generated exports / deferred downloads (tmp)

`generateForDownload` writes an ephemeral file; `consumeGenerated` reads it once and deletes it.

```ts
const key = await storage.generateForDownload({ prefix: "export", extension: "csv", data: csv });
// hand key to a download binding, then:
const bytes = await storage.consumeGenerated(key); // read-once, auto-deleted
```

### Stream a large file to disk

`writeStream` drains a remote/file stream into storage — keeps memory flat for big transfers.

```ts
const response = await fetch("https://example.com/big.iso");
await storage.disk("tmp").writeStream("downloads/big.iso", response.body!);
```

### Scope work to the tmp disk and clean up

Explicit `storage.disk("tmp")` keeps private data untouched; delete trees when done.

```ts
const tmp = storage.disk("tmp");
await tmp.put("cache/1.json", JSON.stringify(data));
await tmp.deleteDirectory("cache"); // wipe the whole folder
```

### Stream a stored file back out

`readStream` sends a file to the UI or to another consumer without buffering the whole thing.

```ts
const stream = await storage.disk("private").readStream("big.bin");
// pipe into a Response, a hash, doWork(stream), etc.
```

## Notes

- Expose storage to the UI through a controller + binding (`<module>.<controller>.<handler>`) so the frontend reaches it in-process without file-system access.
- The layout is mirrored by the [`files`](./files) layer's atomic write semantics, but `storage` is **sandboxed** to its disk root — relative keys with `..` throw.
- `storage.init()` is called once at boot and creates both `private` and `tmp` folders.

## Related

- [files](./files) · [db](./db)