<script setup lang="ts">
import { ref } from "vue";
import deskapp from "@/ui/assets/images/deskapp.png";
import DataTable from "@/ui/components/datatable/index.vue";
import { useGum } from "@/ui/plugins/gum";

interface LogEntry {
  kind: "info" | "ok" | "warn" | "err";
  text: string;
}

const log = ref<LogEntry[]>([]);
const downloadUrl = ref("https://jsonplaceholder.typicode.com/todos/1");
const apiUrl = ref("https://jsonplaceholder.typicode.com/todos/1");
const siteUrl = ref("https://vuejs.org");
const windowTitle = ref("Deskapp · Recipe Demo");

const gum = useGum();
const table = ref<InstanceType<typeof DataTable> | null>(null);

function push(kind: LogEntry["kind"], text: string) {
  log.value.unshift({ kind, text });
  if (log.value.length > 200) log.value.length = 200;
}

// Nested form (works for any module): md.<module>.<controller>.<handler>()
// Flat form also works: bindings['app.window.focus']()

/* app.window.* */
async function openUrlWindow() {
  try {
    push("ok", `app.window.openUrl → ${JSON.stringify(await md.app.window.openUrl(siteUrl.value || "https://vite.dev"))}`);
  } catch (e) {
    push("err", `app.window.openUrl → ${String(e)}`);
  }
}
async function setWindowTitle() {
  try {
    push("ok", `app.window.setTitle → ${JSON.stringify(await md.app.window.setTitle(windowTitle.value))}`);
  } catch (e) {
    push("err", `app.window.setTitle → ${String(e)}`);
  }
}
async function focusWindow() {
  try {
    push("ok", `app.window.focus → ${JSON.stringify(await md.app.window.focus())}`);
  } catch (e) {
    push("err", `app.window.focus → ${String(e)}`);
  }
}
async function toggleAlwaysOnTop() {
  try {
    push("ok", `app.window.toggleAlwaysOnTop → ${JSON.stringify(await md.app.window.toggleAlwaysOnTop())}`);
  } catch (e) {
    push("err", `app.window.toggleAlwaysOnTop → ${String(e)}`);
  }
}
async function createTray() {
  try {
    push("ok", `app.window.createTray → ${JSON.stringify(await md.app.window.createTray())}`);
  } catch (e) {
    push("err", `app.window.createTray → ${String(e)}`);
  }
}
async function confirmSomething() {
  try {
    push("ok", `app.window.confirmSomething → ${JSON.stringify(await md.app.window.confirmSomething("Continue?"))}`);
  } catch (e) {
    push("err", `app.window.confirmSomething → ${String(e)}`);
  }
}
async function alertSomething() {
  try {
    push("ok", `app.window.alertSomething → ${JSON.stringify(await md.app.window.alertSomething("Hello from Deskapp"))}`);
  } catch (e) {
    push("err", `app.window.alertSomething → ${String(e)}`);
  }
}

/* app.storage.* */
async function openFile() {
  try {
    push("ok", `app.storage.open → ${JSON.stringify(await md.app.storage.open())}`);
  } catch (e) {
    push("err", `app.storage.open → ${String(e)}`);
  }
}
async function saveFile() {
  try {
    push("ok", `app.storage.save → ${JSON.stringify(await md.app.storage.save())}`);
  } catch (e) {
    push("err", `app.storage.save → ${String(e)}`);
  }
}
async function uploadFile() {
  try {
    push("ok", `app.storage.upload → ${JSON.stringify(await md.app.storage.upload())}`);
  } catch (e) {
    push("err", `app.storage.upload → ${String(e)}`);
  }
}
async function removeFile() {
  try {
    push("ok", `app.storage.remove → ${JSON.stringify(await md.app.storage.remove())}`);
  } catch (e) {
    push("err", `app.storage.remove → ${String(e)}`);
  }
}
async function listDir() {
  try {
    push("ok", `app.storage.list → ${JSON.stringify(await md.app.storage.list())}`);
  } catch (e) {
    push("err", `app.storage.list → ${String(e)}`);
  }
}
async function downloadFile() {
  try {
    push("ok", `app.storage.download → ${JSON.stringify(await md.app.storage.download(downloadUrl.value))}`);
  } catch (e) {
    push("err", `app.storage.download → ${String(e)}`);
  }
}
async function appSave() {
  try {
    push("ok", `app.storage.appSave → ${JSON.stringify(await md.app.storage.appSave())}`);
  } catch (e) {
    push("err", `app.storage.appSave → ${String(e)}`);
  }
}
async function appLoad() {
  try {
    push("ok", `app.storage.appLoad → ${JSON.stringify(await md.app.storage.appLoad())}`);
  } catch (e) {
    push("err", `app.storage.appLoad → ${String(e)}`);
  }
}
async function appList() {
  try {
    push("ok", `app.storage.appList → ${JSON.stringify(await md.app.storage.appList())}`);
  } catch (e) {
    push("err", `app.storage.appList → ${String(e)}`);
  }
}
async function appExport() {
  try {
    push("ok", `app.storage.appExport → ${JSON.stringify(await md.app.storage.appExport())}`);
  } catch (e) {
    push("err", `app.storage.appExport → ${String(e)}`);
  }
}
async function appDelete() {
  try {
    push("ok", `app.storage.appDelete → ${JSON.stringify(await md.app.storage.appDelete())}`);
  } catch (e) {
    push("err", `app.storage.appDelete → ${String(e)}`);
  }
}

/* app.net.* */
async function fetchPlaceholder() {
  try {
    push("ok", `app.net.placeholder → ${JSON.stringify(await md.app.net.placeholder())}`);
  } catch (e) {
    push("err", `app.net.placeholder → ${String(e)}`);
  }
}
async function fetchJson() {
  try {
    push("ok", `app.net.fetchJson → ${JSON.stringify(await md.app.net.fetchJson(apiUrl.value))}`);
  } catch (e) {
    push("err", `app.net.fetchJson → ${String(e)}`);
  }
}

/* app.playwright.* */
async function play() {
  push("info", "Starting Playwright…");
  try {
    push("ok", `app.playwright.play → ${JSON.stringify(await md.app.playwright.play({ seconds: 3, headless: false }))}`);
  } catch (e) {
    push("err", `app.playwright.play → ${String(e)}`);
  }
}

/* app.demo.* */
async function runQueue() {
  try {
    push(
      "ok",
      `app.demo.queue → ${JSON.stringify(await md.app.demo.queue({ items: ["alpha", "beta", "gamma"], concurrency: 2, delayMs: 150 }))}`
    );
  } catch (e) {
    push("err", `app.demo.queue → ${String(e)}`);
  }
}
async function runSchedule() {
  push("info", "Running cron demo (2s)…");
  try {
    push("ok", `app.demo.schedule → ${JSON.stringify(await md.app.demo.schedule({ seconds: 2 }))}`);
  } catch (e) {
    push("err", `app.demo.schedule → ${String(e)}`);
  }
}

/* Data table (gum / app.demo.table + destroy) */
async function removeRows(ids: Array<string | number>) {
  try {
    const res = await gum.delete("app.demo.destroy", { query: { ids } });
    push("ok", `app.demo.destroy → ${JSON.stringify(res?.data ?? res)}`);
  } catch (e) {
    push("err", `app.demo.destroy → ${String(e)}`);
  }
  await table.value?.load(1);
}
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <img :src="deskapp" class="logo" alt="deskapp">
        <span class="brand-sub">recipes</span>
      </div>
      <div class="chip"><span class="dot"></span> Electron · Vue 3 · SQLite</div>
    </header>

    <section class="hero">
      <p class="eyebrow">Simple calls (module → controller → handler)</p>
      <h1>Call the backend with <span class="grad">bindings</span></h1>
      <p class="sub">
        Logical form: <code>await md.app.window.focus()</code> — <b>bindings</b> → <b>module</b> (<code>app</code>) →
        <b>controller</b> (<code>window</code>) → <b>handler</b> (<code>focus</code>). Works for any module you create.
      </p>
      <pre class="snippet">// controller: src/modules/app/controllers/hello.controller.ts
export const greet = async (name: string) => ({ message: `Hello, ${name}!` });
export const handlers = { greet };

// UI
const res = await md.app.hello.greet('World');</pre>
    </section>

    <section class="grid">
      <article class="card">
        <header>
          <i class="bi bi-window-stack"></i>
          <div>
            <h2>Windows</h2>
            <p><code>md.app.window.*</code></p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="openUrlWindow">Open URL window</button>
          <button class="act" @click="focusWindow">Focus</button>
          <button class="act" @click="toggleAlwaysOnTop">Always on top</button>
          <button class="act" @click="setWindowTitle">Set title</button>
        </div>
        <div class="row"><input v-model="siteUrl" type="url" placeholder="https://vite.dev"></div>
        <div class="row"><input v-model="windowTitle" type="text" placeholder="Window title"></div>
        <div class="actions">
          <button class="act" @click="createTray">Create tray</button>
          <button class="act" @click="confirmSomething">Confirm</button>
          <button class="act" @click="alertSomething">Alert</button>
        </div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-folder2-open"></i>
          <div>
            <h2>Files &amp; storage</h2>
            <p><code>md.app.storage.*</code></p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="openFile">Open</button>
          <button class="act" @click="saveFile">Save</button>
          <button class="act" @click="uploadFile">Upload</button>
          <button class="act" @click="removeFile">Remove</button>
          <button class="act" @click="listDir">List dir</button>
        </div>
        <div class="row">
          <input v-model="downloadUrl" type="url" placeholder="https://example.com/file.zip">
          <button class="act slim" title="Download" @click="downloadFile"><i class="bi bi-download"></i></button>
        </div>
        <div class="actions">
          <button class="act" @click="appSave">App save</button>
          <button class="act" @click="appLoad">App load</button>
          <button class="act" @click="appList">App list</button>
          <button class="act" @click="appExport">Export tmp</button>
          <button class="act danger" @click="appDelete">Delete state</button>
        </div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-globe2"></i>
          <div>
            <h2>Network (no CORS)</h2>
            <p><code>md.app.net.*</code></p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="fetchPlaceholder">Placeholder</button>
          <button class="act accent" @click="fetchJson">Fetch JSON</button>
        </div>
        <div class="row"><input v-model="apiUrl" type="url" placeholder="https://api.github.com/zen"></div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-browser-chrome"></i>
          <div>
            <h2>Playwright</h2>
            <p><code>md.app.playwright.play</code></p>
          </div>
        </header>
        <div class="actions">
          <button class="act accent" @click="play"><i class="bi bi-play-circle"></i> Launch Chromium (3s)</button>
        </div>
        <p class="hint">
          Backend resolves Chromium via facade. <code>npm i playwright && npx playwright install chromium</code> if needed.
        </p>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-lightning-charge"></i>
          <div>
            <h2>Queue &amp; cron</h2>
            <p><code>md.app.demo.*</code></p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="runQueue">Run queue</button>
          <button class="act" @click="runSchedule">Cron · 2s</button>
        </div>
      </article>

      <article class="card wide">
        <header>
          <i class="bi bi-table"></i>
          <div>
            <h2>Data table (gum)</h2>
            <p><code>app.demo.table</code> + <code>app.demo.destroy</code></p>
          </div>
        </header>
        <DataTable ref="table" path="app.demo.table" :option="[10, 25, 50]" @remove="removeRows">
          <template #thead
            ><th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th></template
          >
          <template #tbody="{ td }"
            ><td>{{ td.name }}</td>
            <td>{{ td.email }}</td>
            <td>{{ td.role }}</td>
            <td>{{ td.created }}</td></template
          >
        </DataTable>
      </article>
    </section>

    <section class="term">
      <header>
        <div class="term-title"><i class="bi bi-terminal"></i> Console <span class="cap">— responses</span></div>
        <button class="act slim" title="Clear" @click="log = []"><i class="bi bi-trash3"></i></button>
      </header>
      <pre
        v-if="log.length"
        class="lines"
      ><code v-for="(entry, i) in log" :key="i" :class="'k-' + entry.kind" v-text="entry.text"></code></pre>
      <p v-else class="empty">Click an action. (Works in the Electron app: <code>npm run dev</code>.)</p>
    </section>

    <footer class="foot">
      <span>deskapp starter</span><span class="rule"></span><span><code>md.&lt;module&gt;.&lt;controller&gt;.&lt;handler&gt;()</code></span>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 clamp(16px, 4vw, 48px) 24px;
  background:
    radial-gradient(60rem 32rem at 12% -8%, rgba(78, 163, 255, 0.16), transparent 60%),
    radial-gradient(50rem 30rem at 88% 4%, rgba(34, 211, 238, 0.12), transparent 60%),
    linear-gradient(180deg, var(--dk-bg) 0%, var(--dk-bg-soft) 100%);
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0;
  border-bottom: 1px solid var(--dk-border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-sub {
  font-size: 12px;
  color: var(--dk-faint);
  font-weight: 500;
}
.logo {
  width: auto;
  height: 28px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--dk-muted);
  border: 1px solid var(--dk-border);
  border-radius: 999px;
  padding: 6px 12px;
}
.chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dk-safe);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.45);
  }
  70% {
    box-shadow: 0 0 0 9px rgba(52, 211, 153, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
  }
}
.hero {
  padding: clamp(22px, 4vh, 36px) 0 18px;
}
.eyebrow {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dk-faint);
}
.hero h1 {
  margin: 0 0 10px;
  font-size: clamp(24px, 4.2vw, 38px);
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.08;
}
.hero .grad {
  background: linear-gradient(92deg, var(--dk-accent), var(--dk-accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero .sub {
  margin: 0 0 12px;
  max-width: 780px;
  color: var(--dk-muted);
  font-size: 14px;
  line-height: 1.6;
}
.hero .sub code,
.hint code,
.snippet {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.hero .sub code,
.hint code {
  font-size: 11.5px;
  color: var(--dk-accent-2);
  background: rgba(34, 211, 238, 0.08);
  border-radius: 5px;
  padding: 1px 5px;
}
.snippet {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.55;
  color: #c7d7e8;
  background: rgba(8, 12, 17, 0.85);
  border: 1px solid var(--dk-border);
  border-radius: 12px;
  padding: 12px 14px;
  overflow-x: auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--dk-border);
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(22, 32, 43, 0.85), rgba(14, 20, 27, 0.9));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
}
.card.wide {
  grid-column: 1 / -1;
}
.card > header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card > header > i {
  font-size: 20px;
  color: var(--dk-accent);
  background: rgba(78, 163, 255, 0.12);
  border-radius: 10px;
  padding: 9px;
}
.card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}
.card header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--dk-faint);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dk-text);
  border: 1px solid var(--dk-border);
  border-radius: 9px;
  background: var(--dk-surface-2);
  padding: 8px 12px;
  cursor: pointer;
}
.act:hover {
  border-color: rgba(78, 163, 255, 0.55);
  color: var(--dk-accent);
}
.act.slim {
  padding: 8px 10px;
}
.act.accent {
  background: linear-gradient(92deg, #357dcc, #1f9ec1);
  border-color: transparent;
  color: #fff;
}
.act.danger:hover {
  border-color: rgba(251, 113, 133, 0.6);
  color: var(--dk-err);
}
.row {
  display: flex;
  gap: 7px;
}
.row input {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--dk-text);
  background: var(--dk-surface-2);
  border: 1px solid var(--dk-border);
  border-radius: 9px;
  padding: 8px 11px;
}
.row input:focus {
  outline: none;
  border-color: var(--dk-accent);
}
.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dk-faint);
}
.term {
  margin-top: 14px;
  border: 1px solid var(--dk-border);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(8, 12, 17, 0.85);
}
.term > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dk-border);
}
.term-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
}
.term-title i {
  color: var(--dk-accent);
}
.term-title .cap {
  font-weight: 400;
  color: var(--dk-faint);
}
.lines {
  max-height: 320px;
  overflow: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.6;
  margin: 0;
}
.lines code {
  white-space: pre-wrap;
  word-break: break-word;
}
.k-ok {
  color: var(--dk-safe);
}
.k-err {
  color: var(--dk-err);
}
.k-warn {
  color: var(--dk-warn);
}
.k-info {
  color: var(--dk-accent-2);
}
.empty {
  margin: 0;
  padding: 14px 16px;
  font-size: 12.5px;
  color: var(--dk-faint);
}
.foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 22px;
  font-size: 11.5px;
  color: var(--dk-faint);
}
.foot .rule {
  width: 1px;
  height: 12px;
  background: var(--dk-border);
}
.card :deep(.datatable thead th) {
  background: rgba(78, 163, 255, 0.07);
  border-color: var(--dk-border) !important;
}
.card :deep(.datatable td),
.card :deep(.datatable th) {
  background-color: transparent;
}
@media (max-width: 720px) {
  .chip {
    display: none;
  }
}
</style>
