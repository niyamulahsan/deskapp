# `chromium` — browser automation

Imported from the facade: `import { chromium } from "@/core/facade.ts"`. **Note** — the facade name collides with Playwright's own export, so alias it in your code (`import { chromium as chromiumApi } from "@/core/facade.ts"`).

Shared Chromium resolution so any feature (browser automation, screenshots, scraping, kiosk playback) finds a Chromium binary and any bundled unpacked extensions consistently, in dev and in a packaged build. See [Playwright & Chromium](../guide/playwright).

## Why it exists

A tool like Playwright needs to know *which* Chromium to launch. That binary exists in different places depending on how the app runs:

- **dev**: Playwright's registry cache (installed via its installer), or a path you set,
- **packaged app**: Chromium bundled next to the executable by the bundle step.

`chromium` answers the question "where is the browser + its extensions?" once, and every feature uses the same answer.

## Signature

| Function | Signature | Description |
| --- | --- | --- |
| `exists` | `(path: string) => boolean` | Whether a path exists on disk. |
| `candidates` | `(overrides?: { env?: string \| null; execPath?: string; cwd?: string }) => string[]` | All candidate binaries, in resolution order. |
| `resolve` | `(overrides?: { env?: string \| null; execPath?: string; cwd?: string }) => string \| undefined` | The first existing candidate, or `undefined` (then let Playwright use its registry cache). |
| `extensions` | `(overrides?: { execPath?: string; cwd?: string }) => string[]` | Bundled unpacked-extension folders next to the binary. |

Resolution order for the binary: `DESKAPP_CHROMIUM` env → `<exe dir>/chromium/<platform>/...` → `<cwd>/chromium/<platform>/...` → (fallback) Playwright's registry installer cache, dev only.

## Using it from your own controller

Chromium work belongs in the backend. Write a controller that exposes a handler, and call it from the UI through a binding. The launch flow below is the pattern to use in your controller:

```ts
// src/modules/<your-module>/controllers/browser.controller.ts
import { chromium as pw } from "playwright";
import { chromium as chromiumApi } from "@/core/facade.ts";

export const visit = async (opts?: { url?: string; seconds?: number; headless?: boolean }) => {
  const url = opts?.url?.trim() || "https://example.com";
  const seconds = Math.min(Math.max(opts?.seconds ?? 5, 1), 60);

  const executablePath = chromiumApi.resolve();                      // string | undefined
  const extensions = chromiumApi.extensions().filter(chromiumApi.exists);
  const headless = (opts?.headless ?? false) && extensions.length === 0; // extensions ⇒ force headed

  let browser: unknown;
  try {
    if (extensions.length > 0) {
      // Unpacked extensions require a persistent context + load flags.
      const profile = await Deno.makeTempDir({ prefix: "browser-ext-" });
      const context = await pw.launchPersistentContext(profile, {
        headless: false,                                             // headless shell can't run extensions
        executablePath,
        args: [
          "--disable-extensions-except=" + extensions.join(","),
          ...extensions.map((e) => `--load-extension=${e}`),
        ],
      });
      browser = context;
    } else {
      // No extensions → plain launch (omit executablePath → Playwright registry).
      browser = executablePath
        ? await pw.launch({ headless, executablePath })
        : await pw.launch({ headless });
    }

    const page = (browser as { pages: () => unknown[] }).pages()[0] ?? await (browser as any).newPage();
    await (page as any).goto(url, { waitUntil: "domcontentloaded" });
    const title = await (page as any).title();
    return { ok: true, url, title, headless, extensions: extensions.length };
  } catch (error) {
    return { ok: false, url, error: String(error) };                 // never throw across the binding
  } finally {
    await (browser as { close?: () => Promise<void> } | undefined)?.close();
  }
};

export const handlers = { visit };
```

> The `as any` casts keep the snippet import-light; Playwright's own types give you real types at compile time.
>
> This snippet imports `playwright` directly, which only resolves once you've opted in — `playwright` is **not** in a scaffold's default `deno.json` imports (see [Playwright & Chromium](../guide/playwright)). Add it there and run `deno install` before using browser automation; the first launch auto-downloads the browser binary, or install it manually with `npx playwright install chromium`.

The binding name follows the registry convention `<module>.<controller>.<handler>` — for a module named `"worker"` this becomes `worker.browser.visit`. That is key:

- The UI calls it in-process: `await bindings["worker.browser.visit"]({ url, seconds })`.
- It returns plain JSON, so the result (or the `{ ok: false, error }`) flows straight back to the component resolving the `Promise`.
- Errors never cross the boundary as exceptions — return an error object instead.

## Extensions

Drop each unpacked extension as its own folder at `src/extensions/<name>/` (a folder with a `manifest.json` at its root). At bundle time every directory is copied next to the executable; `chromium.extensions()` then returns those paths in dev *and* in the packaged app. Details and the extension example live in [Playwright & Chromium](../guide/playwright).

Two rules to remember when extensions are present:

1. **Headless must be off** — the headless Chromium shell cannot load extensions.
2. **Playwright needs a persistent context** (`launchPersistentContext`) plus `--disable-extensions-except` / `--load-extension` launch arguments.

## Overriding the binary

`resolve()` honors `DESKAPP_CHROMIUM` first — bundled resolution respects a user- or CI-provided browser:

```ts
// launch the packaged app with: DESKAPP_CHROMIUM=/custom/chrome ./deskapp
const exe = chromiumApi.resolve(); // → /custom/chrome when it exists
```

Debug which paths are considered:

```ts
console.table(chromiumApi.candidates());
```

## Notes

- Tie the feature to any navigation you like — this page plays a URL, but the same resolution feeds screenshots, scraping, or a kiosk.
- Keep automation behind your own controller + binding; the UI stays read-only to the world (bindings are the only in-process bridge).

## Related

- [files](./files) · [storage](./storage)