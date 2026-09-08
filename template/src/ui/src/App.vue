<script setup lang="ts">
import { ref } from 'vue';
import deskapp from './assets/images/deskapp.png';

interface LogEntry {
  kind: 'info' | 'ok' | 'warn' | 'err';
  text: string;
}

const log = ref<LogEntry[]>([]);
const downloadUrl = ref('');
const apiUrl = ref('');
const siteUrl = ref('');

function push(entry: LogEntry) {
  log.value.unshift(entry);
  if (log.value.length > 200) log.value.length = 200;
}

function bindOr(name: string): ((...args: unknown[]) => Promise<unknown>) | null {
  if (typeof bindings === 'undefined') {
    push({
      kind: 'warn',
      text: `${name} — bindings unavailable. Run via \`deno task dev\`.`,
    });
    return null;
  }
  return bindings[name];
}

async function invoke(name: string, ...args: unknown[]) {
  const fn = bindOr(name);
  if (!fn) return;
  try {
    const res = await fn(...args);
    push({ kind: 'ok', text: `${name} → ${JSON.stringify(res)}` });
  } catch (e) {
    push({ kind: 'err', text: `${name} ERROR → ${String(e)}` });
  }
}

async function runStorage(fn: string) {
  await invoke(
    `app.storage.${fn}`,
    ...(fn === 'download' ? [downloadUrl.value.trim()] : []),
  );
}

async function apiRun(name: string, ...args: unknown[]) {
  await invoke(name, ...args);
}

async function openWebWindow() {
  const target = siteUrl.value.trim() || 'https://vite.dev';
  const fn = bindOr('app.window.openUrl');
  if (!fn) return;
  try {
    const opened = await fn(target);
    push({
      kind: opened ? 'ok' : 'warn',
      text: opened ? `Opened ${target} in a second window` : `Could not open ${target}`,
    });
  } catch (e) {
    push({ kind: 'err', text: `app.window.openUrl ERROR → ${String(e)}` });
  }
}
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <img :src="deskapp" class="logo" alt="deskapp" />
      </div>
      <div class="chip"><span class="dot"></span> local stack · running</div>
    </header>

    <section class="hero">
      <p class="eyebrow">Deno Desktop · Vue 3 · SQLite</p>
      <h1>Your desktop app, <span class="grad">batteries included.</span></h1>
      <p class="sub">
        Windows, storage, database, queue, cron and Playwright all run behind this window.
        Press a button — the backend answers in the console.
      </p>
      <div class="quick">
        <button class="q-btn" @click="runStorage('open')">
          <i class="bi bi-folder2-open"></i> Open file
        </button>
        <button class="q-btn accent" @click="apiRun('app.playwright.play')">
          <i class="bi bi-play-circle"></i> Play Chromium
        </button>
        <button class="q-btn" @click="apiRun('app.demo.queue')">
          <i class="bi bi-list-check"></i> Run queue
        </button>
        <button class="q-btn" @click="apiRun('app.demo.schedule', 2)">
          <i class="bi bi-alarm"></i> Run cron
        </button>
        <button class="q-btn" @click="openWebWindow">
          <i class="bi bi-window"></i> New window
        </button>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <header>
          <i class="bi bi-folder2-open"></i>
          <div>
            <h2>Native files</h2>
            <p>Real dialogs on every OS</p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="runStorage('open')">Open</button>
          <button class="act" @click="runStorage('save')">Save</button>
          <button class="act" @click="runStorage('upload')">Upload</button>
          <button class="act" @click="runStorage('remove')">Remove</button>
          <button class="act" @click="runStorage('list')">List</button>
        </div>
        <div class="row">
          <input
            v-model="downloadUrl"
            type="url"
            placeholder="https://example.com/file.zip"
            @keyup.enter="runStorage('download')" />
          <button class="act slim" title="Download" @click="runStorage('download')">
            <i class="bi bi-download"></i>
          </button>
        </div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-hdd"></i>
          <div>
            <h2>App-managed state</h2>
            <p>Private + tmp storage</p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="runStorage('appSave')">Save</button>
          <button class="act" @click="runStorage('appLoad')">Load</button>
          <button class="act" @click="runStorage('appList')">List</button>
          <button class="act" @click="runStorage('appExport')">Export</button>
          <button class="act danger" @click="runStorage('appDelete')">Delete</button>
        </div>
        <p class="hint">JSON kept under <code>src/storage/app/</code> — safe to save anything.</p>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-globe2"></i>
          <div>
            <h2>Network proxy</h2>
            <p>From the backend, no CORS</p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="apiRun('app.net.placeholder')">Placeholder</button>
          <button class="act" @click="apiRun('app.net.fetchJson', apiUrl)">Fetch JSON</button>
        </div>
        <div class="row">
          <input
            v-model="apiUrl"
            type="url"
            placeholder="https://jsonplaceholder.typicode.com/todos/1"
            @keyup.enter="apiRun('app.net.fetchJson', apiUrl)" />
        </div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-window"></i>
          <div>
            <h2>Windows</h2>
            <p>Second windows, by URL</p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="siteUrl = 'https://vuejs.org'">Vue</button>
          <button class="act" @click="siteUrl = 'https://deno.com'">Deno</button>
          <button class="act accent" @click="openWebWindow">
            <i class="bi bi-box-arrow-up-right"></i> Open
          </button>
        </div>
        <div class="row">
          <input
            v-model="siteUrl"
            type="url"
            placeholder="https://vite.dev"
            @keyup.enter="openWebWindow" />
        </div>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-browser-chrome"></i>
          <div>
            <h2>Playwright</h2>
            <p>Backend-controlled Chromium</p>
          </div>
        </header>
        <div class="actions">
          <button class="act accent" @click="apiRun('app.playwright.play')">
            <i class="bi bi-play-circle"></i> Play (≈5s)
          </button>
        </div>
        <p class="hint">
          Launches the bundled Chromium, opens a page, closes it. Needs
          <code>--chromium</code> in the bundle.
        </p>
      </article>

      <article class="card">
        <header>
          <i class="bi bi-lightning-charge"></i>
          <div>
            <h2>Queue &amp; cron</h2>
            <p>In-process scheduling</p>
          </div>
        </header>
        <div class="actions">
          <button class="act" @click="apiRun('app.demo.queue')">Run queue</button>
          <button class="act" @click="apiRun('app.demo.schedule', 2)">Cron · 2s</button>
        </div>
        <p class="hint">Queue jobs run with status tracking; cron ticks every 2s via the scheduler.</p>
      </article>
    </section>

    <section class="term">
      <header>
        <div class="term-title">
          <i class="bi bi-terminal"></i> Console
          <span class="cap">— what the backend answered</span>
        </div>
        <button class="act slim" title="Clear console" @click="log = []">
          <i class="bi bi-trash3"></i>
        </button>
      </header>
      <pre v-if="log.length" class="lines">
        <code
          v-for="(entry, i) in log"
          :key="i"
          :class="'k-' + entry.kind"
          v-text="entry.text"
        ></code>
      </pre>
      <p v-else class="empty">Click an action above — results land here.</p>
    </section>

    <footer class="foot">
      <span>deskapp starter</span>
      <span class="rule"></span>
      <span>Deno Desktop · Vue 3 · Drizzle ORM · SQLite</span>
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

.logo {
  width: 28px;
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
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5);
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
  padding: clamp(28px, 6vh, 56px) 0 28px;
  text-align: center;
}

.eyebrow {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dk-faint);
}

.hero h1 {
  margin: 0 0 14px;
  font-size: clamp(26px, 4.5vw, 44px);
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
  margin: 0 auto;
  max-width: 560px;
  color: var(--dk-muted);
  font-size: 14px;
  line-height: 1.6;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
}

.q-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dk-text);
  border: 1px solid var(--dk-border);
  border-radius: 999px;
  background: rgba(18, 26, 35, 0.7);
  padding: 9px 16px;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.q-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(78, 163, 255, 0.5);
  background: rgba(22, 32, 43, 0.9);
}

.q-btn i {
  color: var(--dk-accent);
}

.q-btn.accent,
.act.accent {
  background: linear-gradient(92deg, #357dcc, #1f9ec1);
  border-color: transparent;
  color: #fff;
}

.q-btn.accent:hover {
  background: linear-gradient(92deg, #4189d8, #27aad0);
}

.q-btn.accent i {
  color: #fff;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--dk-border);
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(22, 32, 43, 0.85), rgba(14, 20, 27, 0.9));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
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
  transition: transform 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.act:hover {
  transform: translateY(-1px);
  border-color: rgba(78, 163, 255, 0.55);
  color: var(--dk-accent);
}

.act.slim {
  padding: 8px 10px;
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

.row input::placeholder {
  color: var(--dk-faint);
}

.row input:focus {
  outline: none;
  border-color: var(--dk-accent);
  box-shadow: 0 0 0 3px rgba(78, 163, 255, 0.15);
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dk-faint);
}

.hint code {
  font-size: 11.5px;
  color: var(--dk-accent-2);
  background: rgba(34, 211, 238, 0.08);
  border-radius: 5px;
  padding: 1px 5px;
}

.term {
  margin-top: 18px;
  border: 1px solid var(--dk-border);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(8, 12, 17, 0.85);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
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
  margin-top: 26px;
  font-size: 11.5px;
  color: var(--dk-faint);
}

.foot .rule {
  width: 1px;
  height: 12px;
  background: var(--dk-border);
}

@media (max-width: 560px) {
  .chip {
    display: none;
  }

  .hero {
    text-align: left;
  }

  .hero .sub {
    margin: 0;
  }

  .quick {
    justify-content: flex-start;
  }
}
</style>