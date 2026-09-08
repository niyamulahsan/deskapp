# Playwright & Chromium

Deskapp bundles Playwright plumbing so backend features can drive a real Chromium (play a site, browser automation, future screenshots/testing). The `chromium` facade on `@/core/facade.ts` is the entry point — see [chromium API](../api/chromium) for the launch pattern.

## Resolving Chromium

`chromium.resolve()` locates a usable Chromium binary. Candidates, in order:

1. **`DESKAPP_CHROMIUM`** environment variable — a user- or CI-provided binary.
2. **Bundled Chromium next to the app binary** — `chromium/<platform>/...` beside the executable, where the bundle step placed it (`dist/<app>/chromium/...` on Windows/Linux, `dist/<app>.app/Contents/MacOS/chromium/...` on macOS).
3. **Bundled Chromium at the working directory** — `chromium/<platform>/...` relative to the launch cwd.
4. **Playwright's registry cache** — the binary Playwright installed via `deno run -A npm:playwright install chromium` (development only; `resolve()` returns `undefined`, and the caller launches without an `executablePath` so Playwright uses its own cache).

```ts
import { chromium } from "@/core/facade.ts";
const exe = chromium.resolve(); // string | undefined
```

`chromium.extensions()` returns unpacked-extension folders shipped next to the binary (or under `<cwd>/src/extensions` in dev). Filter them with `chromium.exists()` before attaching.

## Wiring it to the UI

Chromium run inside your backend controller, exposed as a binding:

```ts
// your controller: <module>.browser.visit
export const visit = async () => { /* chromium.resolve(), launch, navigate, close */ };
export const handlers = { visit };
```

```ts
// your UI component
const result = await bindings["<module>.browser.visit"]({ url, seconds, headless });
```

The registry convention is `<module>.<controller>.<handler>` — in-process, no HTTP/IPC; results come back as plain JSON (errors as `{ ok: false, error }`, never as thrown exceptions).

## Bundling Chromium & extensions

The bundle step can download Chromium into the bundle so the app carries a working browser. See [Bundle](../cli/bundle.md) and its flags.

**Extensions are bundled only when Chromium is bundled** (the default `--chromium=auto`). Every *directory* under `src/extensions/` is treated as one unpacked extension and copied next to the binary — `extensions/<name>/` on Windows/Linux, `Contents/MacOS/extensions/<name>/` on macOS.

## Attaching unpacked extensions

Each folder under `src/extensions/` must be a real unpacked Chrome extension — a directory with a `manifest.json` at its root. A minimal one:

```text
src/extensions/
└── my-extension/
    └── manifest.json      # name, permissions, content_scripts, background, etc.
```

To run Chromium **with** extensions attached:

- Playwright needs a **persistent context** (a temp profile) plus `--load-extension` launch args.
- **Headless is forced off** — the headless Chromium shell cannot load extensions.
- Everything else (navigate, wait, read title, close) works the same.

If you build that logic into your own binding, it will discover `src/extensions/` automatically via `chromium.extensions()` — no hardcoding needed (see the [chromium API page](../api/chromium) for the exact launch code).