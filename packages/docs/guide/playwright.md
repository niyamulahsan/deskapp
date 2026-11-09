# Playwright & Chromium

Deskapp ships Playwright plumbing so backend features can drive a real Chromium (play a site, browser automation, screenshots/testing). The `chromium` facade from `@/core/facade` is the entry point — see [chromium API](../api/chromium) for more details.

> **Playwright is optional.** Add it to your dependencies if you need browser automation:
> 1. `npm install playwright`
> 2. `npx playwright install chromium`

## Resolving Chromium

`chromium.resolve()` locates a usable Chromium binary. Use it when launching Playwright so it finds the right executable in dev or in packaged builds.

```ts
import { chromium } from "@/core/facade";
const exe = chromium.resolve();
```

## Wiring it to the UI (complete example)

### Backend controller

```ts
// src/modules/automation/controllers/browser.controller.ts
import { chromium } from "@/core/facade";
import { chromium as pwChromium } from "playwright";

export const visit = async (opts: { url: string; waitSeconds?: number; headless?: boolean } = { url: "https://example.com" }) => {
  try {
    const exe = chromium.resolve();
    const browser = await pwChromium.launch({ executablePath: exe || undefined, headless: opts.headless !== false });
    const page = await browser.newPage();
    await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (opts.waitSeconds) {
      await page.waitForTimeout(opts.waitSeconds * 1000);
    }
    const title = await page.title();
    const url = page.url();
    const screenshot = await page.screenshot({ fullPage: true });
    await browser.close();
    return { ok: true, title, url, screenshot: screenshot.toString("base64") };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
};

export const getHtml = async (opts: { url: string; headless?: boolean } = { url: "https://example.com" }) => {
  try {
    const exe = chromium.resolve();
    const browser = await pwChromium.launch({ executablePath: exe || undefined, headless: opts.headless !== false });
    const page = await browser.newPage();
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: 60000 });
    const html = await page.content();
    await browser.close();
    return { ok: true, html };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
};

export const handlers = { visit, getHtml };
```

### Frontend (Vue)

```vue
<script setup lang="ts">
import { ref } from 'vue';

const url = ref('https://example.com');
const loading = ref(false);
const result = ref<any>(null);

async function runVisit() {
  loading.value = true;
  try {
    result.value = await bindings['automation.browser.visit']({ url: url.value, headless: true, waitSeconds: 2 });
  } finally {
    loading.value = false;
  }
}

async function getHtml() {
  loading.value = true;
  try {
    result.value = await bindings['automation.browser.getHtml']({ url: url.value, headless: true });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <input v-model="url" placeholder="Enter URL" />
    <button :disabled="loading" @click="runVisit">Visit & Screenshot</button>
    <button :disabled="loading" @click="getHtml">Get HTML</button>
    <pre v-if="result">{{ result.ok ? (result.title || result.html?.slice(0,200)) : result.error }}</pre>
    <img v-if="result?.ok && result.screenshot" :src="'data:image/png;base64,' + result.screenshot" style="max-width:100%" />
  </div>
</template>
```

The registry convention is `<module>.<controller>.<handler>`. Results come back as plain JSON (errors as `{ ok: false, error }`).

## Bundling Chromium & extensions

When packaging with electron-builder, ensure any bundled Chromium/extensions are placed correctly. For unpacked extensions, put them in `src/extensions/` and load with persistent context and `--load-extension` args as shown in the recipes.
