# Recipes & Examples

Practical examples for building real features in Deskapp.

## 1) Create a backend module and call it from the frontend

### Create a module with a controller

```sh
npm run maker make:module demo
npm run maker make:controller demo hello
```

### Write a handler

```ts
// src/modules/demo/controllers/hello.controller.ts
export const greet = async (name: string) => {
  return { message: `Hello, ${name}!` };
};

export const getTime = async () => {
  return { time: new Date().toISOString() };
};

export const handlers = { greet, getTime };
```

Regenerate bindings (dev does this automatically, but you can do it manually):

```sh
npm run maker bindings:gen
```

### Call from Vue

You can use either form:

```vue
<script setup lang="ts">
import { ref } from 'vue';

const name = ref('World');
const result = ref<any>(null);

async function sayHello() {
  // Nested form with md (recommended)
  result.value = await md.demo.hello.greet(name.value);
  // Or flat form: await bindings['demo.hello.greet'](name.value)
}

async function getTime() {
  result.value = await md.demo.hello.getTime();
}
</script>

<template>
  <input v-model="name" />
  <button @click="sayHello">Greet</button>
  <button @click="getTime">Get Time</button>
  <pre>{{ result }}</pre>
</template>
```

## 2) File operations (create, read, write)

Use the storage/files API from the facade. The framework provides `files` and `storage` utilities.

### In a controller

```ts
// src/modules/files/controllers/io.controller.ts
import { files, storage } from "@/core/facade";
import path from "node:path";

export const writeJson = async (filename: string, data: any) => {
  const fullPath = path.join(storage.getAppDataDir(), filename);
  await files.writeTextFile(fullPath, JSON.stringify(data, null, 2));
  return { ok: true, path: fullPath };
};

export const readJson = async (filename: string) => {
  const fullPath = path.join(storage.getAppDataDir(), filename);
  const text = await files.readTextFile(fullPath);
  return JSON.parse(text);
};

export const writeBuffer = async (filename: string, base64: string) => {
  const fullPath = path.join(storage.getAppDataDir(), filename);
  const buf = Buffer.from(base64, "base64");
  await files.writeFile(fullPath, buf);
  return { ok: true };
};

export const list = async (dir?: string) => {
  const target = dir || storage.getAppDataDir();
  const entries = await files.readDir(target);
  return entries;
};

export const handlers = { writeJson, readJson, writeBuffer, list };
```

### From UI

```ts
// Write a file
await bindings['files.io.writeJson']('config.json', { theme: 'dark' });

// Read it back
const config = await bindings['files.io.readJson']('config.json');

// Let user pick a file
import { pickers } from "@/core/facade"; // or call via binding
const picked = await bindings['app.pickers.open']?.({ title: 'Select file' });
```

For user-chosen files, use the native pickers (`pickers.open/save/folder`) exposed via the facade or through your own controllers.

## 3) Web automation with Playwright

The template includes Playwright utilities. You can create a controller to automate browsers.

### Setup

Add Playwright to dependencies if not present, and install browsers:

```sh
npm install playwright
npx playwright install chromium
```

### Controller example

```ts
// src/modules/automation/controllers/browser.controller.ts
import { chromium } from "@/core/facade";
import { chromium as pwChromium } from "playwright";

export const scrape = async (url: string) => {
  const execPath = await chromium.resolve();
  const browser = await pwChromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const title = await page.title();
  const content = await page.content();
  await browser.close();
  return { title, length: content.length };
};

export const screenshot = async (url: string) => {
  const execPath = await chromium.resolve();
  const browser = await pwChromium.launch({ executablePath: execPath, headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  const buffer = await page.screenshot({ fullPage: true });
  await browser.close();
  return buffer.toString('base64');
};

export const handlers = { scrape, screenshot };
```

### From UI

```ts
const result = await bindings['automation.browser.scrape']('https://example.com');
const b64 = await bindings['automation.browser.screenshot']('https://example.com');
const img = document.createElement('img');
img.src = 'data:image/png;base64,' + b64;
document.body.appendChild(img);
```

## 4) Adding browser extensions

You can load extensions with Playwright's Chromium. Extensions go in `src/extensions/` and can be copied during packaging.

### Example

```ts
// src/modules/automation/controllers/extension.controller.ts
import { chromium } from "@/core/facade";
import { chromium as pwChromium } from "playwright";
import path from "node:path";

export const runWithExtension = async (url: string) => {
  const execPath = await chromium.resolve();
  const extensionPath = path.resolve(process.cwd(), "src/extensions/my-extension");
  const userDataDir = path.resolve(process.cwd(), "src/storage/chrome-user-data");
  
  const context = await pwChromium.launchPersistentContext(userDataDir, {
    executablePath: execPath,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  
  const page = await context.newPage();
  await page.goto(url);
  // ... do automation
  await context.close();
  return { ok: true };
};

export const handlers = { runWithExtension };
```

Place your unpacked extension in `src/extensions/my-extension/` with a valid `manifest.json`. In packaged builds, copy logic depends on your packaging setup; for development this works as shown.

## 5) Track connected users (remote DB / online server)

If you use a remote database (e.g., hosted Postgres/LibSQL/Turso), you can track active sessions. Options:

### Using WebSocket presence (recommended)

Add a presence system using Socket.IO or custom WebSocket. Track connections in memory with heartbeats.

```ts
// src/modules/presence/controllers/presence.controller.ts
const connections = new Map<string, { userId?: string, lastSeen: number }>();

export const heartbeat = async (clientId: string, userId?: string) => {
  connections.set(clientId, { userId, lastSeen: Date.now() });
  return { ok: true };
};

export const listActive = async (ttlMs = 60000) => {
  const now = Date.now();
  const active: any[] = [];
  for (const [clientId, info] of connections) {
    if (now - info.lastSeen < ttlMs) {
      active.push({ clientId, ...info });
    } else {
      connections.delete(clientId);
    }
  }
  return { count: active.length, users: active };
};

export const handlers = { heartbeat, listActive };
```

On the frontend, send heartbeats periodically:

```ts
const clientId = crypto.randomUUID();
setInterval(() => {
  bindings['presence.presence.heartbeat'](clientId, currentUserId);
}, 30000);
```

### Using database sessions

If you store sessions in the DB, query for sessions with recent activity:

```ts
import { db } from "@/core/facade";
import { sessions } from "@/modules/auth/database/models/session.model";
import { gt } from "drizzle-orm";

export const countActive = async () => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const result = await db.select().from(sessions).where(gt(sessions.lastSeen, cutoff));
  return { count: result.length };
};

export const handlers = { countActive };
```

## 6) Excel, CSV, PDF generation

Install common libraries in your app:

```sh
npm install exceljs csv-writer pdf-lib puppeteer-core
# or use lightweight options
npm install json2csv pdfkit
```

### Excel with exceljs

```ts
// src/modules/export/controllers/excel.controller.ts
import ExcelJS from 'exceljs';
import { files, storage } from "@/core/facade";
import path from "node:path";

export const exportExcel = async (data: any[]) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  
  if (data.length > 0) {
    ws.columns = Object.keys(data[0]).map(k => ({ header: k, key: k }));
    ws.addRows(data);
  }
  
  const buffer = await wb.xlsx.writeBuffer();
  const outPath = path.join(storage.getAppDataDir(), `export_${Date.now()}.xlsx`);
  await files.writeFile(outPath, Buffer.from(buffer));
  return { ok: true, path: outPath };
};

export const handlers = { exportExcel };
```

### CSV

```ts
import { createObjectCsvWriter } from 'csv-writer';

export const exportCsv = async (data: any[], headers: any[]) => {
  const outPath = path.join(storage.getAppDataDir(), `export_${Date.now()}.csv`);
  const csvWriter = createObjectCsvWriter({
    path: outPath,
    header: headers,
  });
  await csvWriter.writeRecords(data);
  return { ok: true, path: outPath };
};
```

### PDF

```ts
import PDFDocument from 'pdfkit';
import fs from 'fs';

export const exportPdf = async (text: string) => {
  const outPath = path.join(storage.getAppDataDir(), `export_${Date.now()}.pdf`);
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.text(text);
  doc.end();
  await new Promise(r => stream.on('finish', r));
  return { ok: true, path: outPath };
};
```

## 7) Audio and video streaming

For local files, serve via the backend or read and stream. For large files, stream in chunks.

### Stream local file

```ts
// src/modules/media/controllers/stream.controller.ts
import fs from "fs";
import path from "path";
import { storage } from "@/core/facade";

export const getFileInfo = async (filename: string) => {
  const fullPath = path.join(storage.getAppDataDir(), filename);
  const stat = fs.statSync(fullPath);
  return { size: stat.size, path: fullPath };
};

export const readChunk = async (filename: string, start: number, end: number) => {
  const fullPath = path.join(storage.getAppDataDir(), filename);
  const fd = fs.openSync(fullPath, 'r');
  const buffer = Buffer.alloc(end - start + 1);
  fs.readSync(fd, buffer, 0, buffer.length, start);
  fs.closeSync(fd);
  return buffer.toString('base64');
};

export const handlers = { getFileInfo, readChunk };
```

From the UI (audio/video), you can construct data URLs for small files or use range requests. For better performance, consider using a local HTTP server or streaming via IPC in chunks.

### Simple audio playback from base64

```vue
<script setup>
import { ref } from 'vue';

const audioSrc = ref('');

async function play() {
  const b64 = await bindings['media.stream.readChunk']('song.mp3', 0, 1000000);
  audioSrc.value = 'data:audio/mpeg;base64,' + b64;
}
</script>

<template>
  <button @click="play">Load</button>
  <audio v-if="audioSrc" :src="audioSrc" controls></audio>
</template>
```

For full video/audio streaming with seeking, better to use chunked reading with proper range handling or run a local static server. You can also use Electron's protocol handlers for custom schemes.

## 8) Open a popup/new window, routes, menus & tray

### Define windows in config

```ts
// src/window/config.ts
export const windows = {
  main: { title: "Deskapp", width: 1280, height: 800, route: "/" },
  settings: { title: "Settings", width: 600, height: 500, route: "/settings" },
  preview: { title: "Preview", width: 900, height: 700, route: "/preview" },
};
```

### Add routes in the UI

```ts
// src/ui/src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../pages/dashboard/index.vue';
import Settings from '../pages/settings/index.vue';
import Preview from '../pages/preview/index.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
    { path: '/preview', component: Preview },
  ],
});
```

### Open windows from UI

```ts
// src/modules/app/controllers/window.controller.ts
import { win } from "@/core/facade";

export const openSettings = async () => {
  const w = await win.openWindow("settings");
  return { ok: !!w };
};

export const openCustom = async (opts: any) => {
  const w = await win.openWindow({ 
    title: opts.title, 
    width: opts.width || 800, 
    height: opts.height || 600, 
    route: opts.route || "/" 
  });
  return { ok: !!w };
};

export const getMain = async () => {
  const w = win.getWindow();
  return { exists: !!w };
};

export const setMainTitle = async (title: string) => {
  const w = win.getWindow();
  if (w) w.setTitle(title);
  return { ok: !!w };
};

export const handlers = { openSettings, openCustom, getMain, setMainTitle };
```

```vue
<script setup>
async function openSettings() {
  await bindings['app.window.openSettings']();
}

async function openPreview() {
  await bindings['app.window.openCustom']({ title: 'Item Preview', width: 800, height: 600, route: '/preview' });
}

async function changeTitle() {
  await bindings['app.window.setMainTitle']('My App - Updated');
}
</script>

<template>
  <button @click="openSettings">Open Settings Window</button>
  <button @click="openPreview">Open Preview Window</button>
  <button @click="changeTitle">Change Main Window Title</button>
</template>
```

### Window options

Common options: `title`, `width`, `height`, `x`, `y`, `resizable`, `alwaysOnTop`, `frameless`, `route`, `chrome` (set to `false` to hide default menu/tray).

### Menus & Tray

```ts
// src/modules/app/controllers/menu.controller.ts
import { chrome, win } from "@/core/facade";

export const setupChrome = async () => {
  const w = win.getWindow();
  if (w) {
    chrome.setupDesktopChrome(w);
    return { ok: true };
  }
  return { ok: false };
};

export const showTray = async () => {
  const tray = chrome.createAppTray();
  return { ok: !!tray };
};

export const showAlertFromMenu = async () => {
  chrome.alertDialog("Hello from menu!");
  return { ok: true };
};

export const handlers = { setupChrome, showTray, showAlertFromMenu };
```

You can also customize menus directly. The template's `src/window/native.ts` has helpers for default menus/tray - `chrome.setupDesktopChrome()` is the easiest way to add standard app chrome. For headless/tray-only mode, use `chrome.hideDock()` and `chrome.createHeadlessTray()`.

## 9) File pickers, open/save/folder dialogs

Use `pickers` from the facade. Expose via bindings for UI use.

### Controller

```ts
// src/modules/app/controllers/dialogs.controller.ts
import { pickers, chrome } from "@/core/facade";

export const openFile = async (opts: any = {}) => {
  const path = await pickers.open(opts);
  return { path };
};

export const saveFile = async (opts: any = {}) => {
  const path = await pickers.save(opts);
  return { path };
};

export const pickFolder = async (opts: any = {}) => {
  const path = await pickers.folder(opts);
  return { path };
};

export const alert = async (message: string) => {
  chrome.alertDialog(message);
  return { ok: true };
};

export const confirm = async (message: string) => {
  const result = chrome.confirmDialog(message);
  return { confirmed: result };
};

export const prompt = async (message: string, defaultValue?: string) => {
  const result = chrome.promptDialog(message, defaultValue);
  return { value: result }; // null if cancelled
};

export const handlers = { openFile, saveFile, pickFolder, alert, confirm, prompt };
```

### Frontend (Vue)

```vue
<script setup lang="ts">
import { ref } from 'vue';

const selectedFile = ref<string | null>(null);
const savedPath = ref<string | null>(null);
const folderPath = ref<string | null>(null);
const promptValue = ref<string | null>(null);

async function chooseFile() {
  const res = await bindings['app.dialogs.openFile']({
    title: 'Select a file',
    // filters vary by platform; example:
    // filter: 'Text files (*.txt)|*.txt|All files (*.*)|*.*'
  });
  selectedFile.value = res.path;
}

async function saveAs() {
  const res = await bindings['app.dialogs.saveFile']({
    title: 'Save As',
    defaultName: 'document.txt',
  });
  savedPath.value = res.path;
}

async function pickFolder() {
  const res = await bindings['app.dialogs.pickFolder']({ title: 'Select folder' });
  folderPath.value = res.path;
}

async function showAlert() {
  await bindings['app.dialogs.alert']('Operation completed!');
}

async function showConfirm() {
  const res = await bindings['app.dialogs.confirm']('Are you sure you want to continue?');
  alert(res.confirmed ? 'Confirmed' : 'Cancelled');
}

async function showPrompt() {
  const res = await bindings['app.dialogs.prompt']('Enter your name:', 'John');
  promptValue.value = res.value;
}
</script>

<template>
  <div>
    <h3>File Dialogs</h3>
    <button @click="chooseFile">Open File</button>
    <p>Selected: {{ selectedFile }}</p>
    <button @click="saveAs">Save As</button>
    <p>Saved to: {{ savedPath }}</p>
    <button @click="pickFolder">Pick Folder</button>
    <p>Folder: {{ folderPath }}</p>

    <h3>Native Message Dialogs</h3>
    <button @click="showAlert">Alert</button>
    <button @click="showConfirm">Confirm</button>
    <button @click="showPrompt">Prompt</button>
    <p v-if="promptValue !== null">Prompt value: {{ promptValue }}</p>
  </div>
</template>
```

## 10) Queue, Scheduler, Net, Storage - when and how

### Queue (background jobs)

Use for long-running tasks that shouldn't block the UI. Register processors and enqueue jobs.

```ts
// src/modules/jobs/controllers/queue.controller.ts
import { queue } from "@/core/facade";

export const enqueue = async (payload: any) => {
  // Add job to queue
  const jobId = await queue.add("demo.task", payload);
  return { jobId };
};

export const getStatus = async () => {
  return { status: "ok" };
};

export const handlers = { enqueue, getStatus };
```

Register processors (often in a service/bootstrap file):

```ts
// Example processor registration
import { queue } from "@/core/facade";

queue.process("demo.task", async (job) => {
  console.log("Processing job:", job.data);
  // Do heavy work here
  await new Promise((r) => setTimeout(r, 2000));
  console.log("Done");
});
```

From UI:

```vue
<script setup>
async function runJob() {
  const res = await bindings['jobs.queue.enqueue']({ file: 'large.csv' });
  console.log('Job queued:', res.jobId);
}
</script>
<template><button @click="runJob">Enqueue Background Job</button></template>
```

### Scheduler (cron)

Use for recurring tasks.

```ts
// src/modules/jobs/controllers/scheduler.controller.ts
import { cron } from "@/core/facade";

export const startTicker = async () => {
  cron.schedule("demo.ticker", "*/5 * * * * *", async () => {
    console.log("Tick every 5 seconds");
  });
  return { ok: true };
};

export const stopTicker = async () => {
  cron.stop("demo.ticker");
  return { ok: true };
};

export const handlers = { startTicker, stopTicker };
```

From UI:

```vue
<button @click="() => bindings['jobs.scheduler.startTicker']()">Start</button>
<button @click="() => bindings['jobs.scheduler.stopTicker']()">Stop</button>
```

### Net (HTTP requests)

For external API calls without CORS issues, proxy through backend.

```ts
// src/modules/app/controllers/net.controller.ts
export const fetchRemote = async (url: string) => {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
};

export const handlers = { fetchRemote };
```

From UI:

```vue
<script setup>
import { ref } from 'vue';
const data = ref(null);
async function load() {
  data.value = await bindings['app.net.fetchRemote']('https://api.github.com/zen');
}
</script>
<template><button @click="load">Fetch</button><pre>{{ data }}</pre></template>
```

### Storage

Two layers - use as appropriate:

```ts
import { storage, files } from "@/core/facade";
import path from "node:path";

// App-managed (private) - persistent app data
const appDir = storage.getAppDataDir();
await files.writeTextFile(path.join(appDir, "settings.json"), JSON.stringify({ theme: "dark" }, null, 2));
const settings = JSON.parse(await files.readTextFile(path.join(appDir, "settings.json")));

// App-managed (tmp) - temporary files
const tmpDir = storage.getTmpDir();
await files.writeTextFile(path.join(tmpDir, "temp.txt"), "hi");

// Or use storage API directly
await storage.put("cache/data.json", JSON.stringify({ cached: true }));
const bytes = await storage.get("cache/data.json");

// User files - use pickers + files directly with chosen paths
const userPath = await pickers.save({ defaultName: "export.json" });
if (userPath) await files.writeTextFile(userPath, JSON.stringify({ data: [] }, null, 2));
```

## 11) API Quick Reference (purpose & usage)

Import from `@/core/facade` in backend code (controllers/jobs). From UI use `bindings`.

| API                | Purpose                           | Common Usage                                                               |
| ------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| `db`               | Drizzle ORM instance + init/close | `await db.select().from(table)`, `await db.insert()...`                    |
| `paginate` / `sql` | Pagination helpers                | `paginate.model({ table, query: db.query.table, page, perPage })`          |
| `pass`             | Password hashing/verification     | `await pass.hashPassword(pw)`, `await pass.verifyPassword(pw, hash)`       |
| `validate`         | Zod validation                    | `const data = await validate.run(schema, input); validate.z.object({...})` |
| `queue`            | Background job queue              | `queue.add('task.name', payload)`, register processors                     |
| `cron`             | Scheduler                         | `cron.schedule('id', '*/5 * * * *', fn)`, `cron.stop('id')`                |
| `storage`          | App-managed files (private/tmp)   | `storage.put()`, `storage.get()`, `storage.disk('tmp')`                    |
| `files`            | User-file operations              | Read/write arbitrary paths, atomic operations                              |
| `chromium`         | Playwright/Chromium helpers       | `chromium.resolve()` to get executable path                                |
| `win`              | Window management                 | `win.openWindow()`, `win.getWindow()`, `win.createWindow()`                |
| `chrome`           | Menus, tray, dialogs              | `chrome.setupDesktopChrome()`, `chrome.confirmDialog()`                    |
| `pickers`          | Native file dialogs               | `pickers.open()`, `pickers.save()`, `pickers.folder()`                     |

### Detailed examples

```ts
// DB
import { db } from "@/core/facade";
import { users } from "@/modules/auth/database/models/user.model";
const all = await db.select().from(users);

// Validation
import { validate } from "@/core/facade";
const schema = validate.z.object({ email: validate.z.string().email() });
const data = await validate.run(schema, input);

// Queue
import { queue } from "@/core/facade";
await queue.add('email.send', { to: 'x@y.com' });

// Cron
import { cron } from "@/core/facade";
cron.schedule('cleanup', '0 0 * * *', async () => { /* daily */ });

// Pickers
import { pickers } from "@/core/facade";
const file = await pickers.open({ title: 'Open' });
```

## Tips

- Always use `@/core/facade` imports in controllers.
- Regenerate bindings with `npm run maker bindings:gen` after adding controllers/handlers.
- Use `storage.getAppDataDir()` / `storage.getTmpDir()` for app-managed files.
- For large operations, consider using the queue/scheduler.
- Keep sensitive logic in the main process (controllers), expose only what's needed via bindings.
- Open new windows via `win.openWindow()` from controllers; add routes to the Vue router.
- For picker/dialog access from UI, create controller wrappers that call the facade functions.
