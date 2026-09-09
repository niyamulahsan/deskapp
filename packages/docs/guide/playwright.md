# Playwright & Chromium

Deskapp ships Playwright plumbing so backend features can drive a real Chromium (play a site, browser automation, screenshots/testing), plus a working demo — `app.playwright.play` on the dashboard. The `chromium` facade on `@/core/facade.ts` is the entry point — see [chromium API](../api/chromium) for the launch pattern.

> **Playwright is optional.** It is *not* in a scaffold's default `deno.json` imports — only the demo consumes it, so scaffolds start without the package. To enable browser automation:
>
> 1. Add `"playwright": "npm:playwright@^1.61.1"` to `deno.json` → `imports`.
> 2. Run `deno install`.
> 3. First `app.playwright.play` downloads the browser binary automatically.
>
> If you don't need the demo itself, delete `src/modules/app/controllers/playwright.controller.ts` (and its dashboard entry) — the `chromium` facade and the resolution below remain available for your own controllers.

## Resolving Chromium

`chromium.resolve()` locates a usable Chromium binary. Candidates, in order:

1. **`DESKAPP_CHROMIUM`** environment variable — a user- or CI-provided binary.
2. **Bundled Chromium next to the app binary** — `chromium/<platform>/...` beside the executable, where the bundle step placed it (`dist/<app>/chromium/...` on Windows/Linux, `dist/<app>.app/Contents/MacOS/chromium/...` on macOS).
3. **Bundled Chromium at the working directory** — `chromium/<platform>/...` relative to the launch cwd.
4. **Playwright's registry cache** — the development fallback: `resolve()` returns `undefined`, and the caller launches *without* an `executablePath` so Playwright uses its own cache. The browser for that cache is not part of `deno install` — it downloads it automatically on the first `app.playwright.play` (or your own binding that follows the same pattern). If the auto-download fails, the returned error shows the manual fallback: `npx playwright install chromium`.

```ts
import { chromium } from "@/core/facade.ts";
const exe = chromium.resolve(); // string | undefined
```

`chromium.extensions()` returns unpacked-extension folders shipped next to the binary (or under `<cwd>/src/extensions` in dev). Filter them with `chromium.exists()` before attaching.

## Installing the browser manually

If you prefer (or the auto-download can't run), install the browser yourself. **Use the version your project actually installs** — `npx playwright install chromium` picks it up from `node_modules`. Avoid the bare `deno run -A npm:playwright install chromium`: Deno can resolve a *different* cached `npm:playwright` version and download a browser build your app can't find:

```sh
npx playwright install chromium          # correct: uses the installed playwright from node_modules
# do NOT use: deno run -A npm:playwright install chromium   # may download the wrong build
```

> **Troubleshooting:** if `app.playwright.play` comes back with `Failed to spawn '...': Invalid handle` on **Windows**, Smart App Control is blocking the process spawn — see [Windows & Native APIs — Known quirks](../guide/windows.md#known-quirks). Disable SAC temporarily, retry, then re-enable it. macOS/Linux need no such step.

## The browser cache & freeing space

Downloaded browsers live in a single **per-user registry outside your project**, keyed by Playwright revision:

| OS | Folder |
| --- | --- |
| Windows | `%LOCALAPPDATA%\ms-playwright` |
| macOS | `~/Library/Caches/ms-playwright` |
| Linux | `~/.cache/ms-playwright` |

Inside it: `chromium-<rev>` / `chromium_headless_shell-<rev>` are the browser binaries (the bulk), `ffmpeg-<rev>` is only needed for video recording, and `winldd-*`/`dep-*` are tiny helpers. The npm package itself is a separate, small download in `node_modules`/Deno's npm cache.

To free the space when you don't need browser automation:

```sh
npx playwright uninstall chromium        # removes this install's browsers (needs a project with playwright)
# or delete the whole folder — same effect, and it clears every version:
rm -rf ~/Library/Caches/ms-playwright    # macOS
rm -rf ~/.cache/ms-playwright            # Linux
# Windows (PowerShell):
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\ms-playwright"
```

Then drop the dependency entirely: remove `"playwright"` from `deno.json` imports and run `deno install`. Nothing in this cache ever ends up in your project unless you explicitly bundle it (see [Bundle](../cli/bundle) — bundling copies the **newest** `chromium-*` revision found here, so stale/mismatched builds can be picked up; keep only the revision your resolved playwright version expects).

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