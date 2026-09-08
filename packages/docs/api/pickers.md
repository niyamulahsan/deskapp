# `pickers` — native file/folder pickers

Imported from the facade: `import { pickers } from "@/core/facade.ts"`.

Real OS dialogs behind one cross-platform API (WinForms on Windows, NSOpenPanel/NSSavePanel on macOS, zenity/kdialog on Linux). All return the chosen absolute path, or `null` when the user cancels or the dialog fails. See [Windows & Native APIs](../guide/windows).

## Functions

| Function | Signature | Description |
| --- | --- | --- |
| `open` | `(options?: PickOpenOptions) => Promise<string \| null>` | Native "Open a file" dialog. |
| `save` | `(options?: PickSaveOptions) => Promise<string \| null>` | Native "Save As" dialog. |
| `folder` | `(options?: PickFolderOptions) => Promise<string \| null>` | Native folder-chooser. |

## Types

```ts
interface PickOpenOptions { title?: string; filter?: string; }
interface PickSaveOptions { title?: string; defaultName?: string; filter?: string; }
interface PickFolderOptions { title?: string; }
```

`filter` uses WinForms syntax, e.g. `"Text files (*.txt)|*.txt|All files (*.*)|*.*"`; ignored on macOS/Linux where the OS provides its own filters.

## Use cases

### Import a file (open → read → process)

The classic "choose a file to open" flow. Always check for `null` (cancel).

```ts
import { pickers, files } from "@/core/facade.ts";

const src = await pickers.open({ title: "Import contacts", filter: "CSV files (*.csv)|*.csv" });
if (!src) return; // user cancelled
const csv = await files.readTextFile(src);
```

### Export with a default filename (save)

Suggest a name and let the user pick the destination folder.

```ts
const dest = await pickers.save({ title: "Export contacts", defaultName: "contacts.csv" });
if (dest) await files.writeTextFile(dest, csv);
```

### Restrict to a file type (filter)

Only show relevant files in the dialog.

```ts
const img = await pickers.open({
  title: "Choose a logo",
  filter: "Images (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg|All files (*.*)|*.*",
});
if (img) {
  const bytes = await files.readBinaryFile(img);
  // ...
}
```

### Process a whole folder

Pick a folder, then iterate its contents with `files.listFiles`.

```ts
const dir = await pickers.folder({ title: "Choose a photos folder" });
if (!dir) return;

const images = (await files.listFiles(dir)).filter((p) => p.match(/\.(png|jpg|jpeg)$/i));
for (const image of images) {
  const meta = await files.fileMeta(image);
  if (meta) await queueThumbnail(meta.path);
}
```

## Notes

- Cancelling (or the dialog tool missing on Linux) returns `null` — always check before using the path.
- Expose a picker to the UI via a controller + binding (the chosen path flows back to the component as plain JSON).
- Combine with the [`files`](./files) namespace: pick a path, then read/write/copy it.