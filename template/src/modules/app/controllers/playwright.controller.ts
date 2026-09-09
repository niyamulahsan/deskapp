import { basename } from "@std/path";
import { chromium as chromiumApi } from "@/core/facade.ts";
import { ensurePlaywrightBrowser, existsPath } from "@/core/utils/playwright.ts";

// playwright is an OPTIONAL dependency: it's only needed for this demo, so it
// is not in the default imports map. `"play" + "wright"` (non-literal) keeps
// Deno's export/publish rewrite from treating it as an import specifier —
// resolution happens at runtime, and if it's missing the UI shows how to
// enable it instead of failing at startup.
const PW_SPEC = "play" + "wright";
const NEED_PLAYWRIGHT =
  '"playwright" is not installed. Add "playwright": "npm:playwright@^1.61.1" to deno.json imports, run "deno install", then retry.';

interface PlaywrightPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  title(): Promise<string>;
}
interface PlaywrightBrowser {
  newPage(): Promise<PlaywrightPage>;
  pages(): Promise<PlaywrightPage[]>;
  close(): Promise<void>;
}
interface PlaywrightChromium {
  executablePath(): string;
  launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser>;
  launchPersistentContext(userDataDir: string, options: Record<string, unknown>): Promise<PlaywrightBrowser>;
}

async function loadChromium(): Promise<PlaywrightChromium> {
  let resolved: string;
  try {
    resolved = import.meta.resolve(PW_SPEC);
  } catch (error) {
    throw new Error(`${String(error)} - ${NEED_PLAYWRIGHT}`);
  }
  const mod = (await import(resolved)) as { chromium?: PlaywrightChromium };
  if (!mod.chromium) throw new Error(NEED_PLAYWRIGHT);
  return mod.chromium;
}

/**
 * playwright.controller.ts (app module) - browser automation demo.
 *
 * `app.playwright.play` launches Chromium from the backend, opens a site,
 * keeps it open for a few seconds, then closes it. The UI "Play" button
 * triggers this through the bindings.
 *
 * Chromium resolution is shared via src/core/utils/playwright.ts. When the
 * app ships bundled extensions (`extensions/<name>/` folders next to the
 * binary), they are auto-loaded via a persistent context (Playwright requires
 * a persistent context + `--load-extension` to attach unpacked extensions).
 * Headless is forced off while extensions are attached (the headless shell
 * can't run extensions).
 */

const EXAMPLE = "https://example.com";
const DEFAULT_SECONDS = 5;

function extensionArgs(extensions: string[]): string[] {
  return [
    "--disable-extensions-except=" + extensions.join(","),
    ...extensions.map((e) => `--load-extension=${e}`),
  ];
}

export const play = async (opts?: { url?: string; seconds?: number; headless?: boolean; extensions?: string[]; }): Promise<Record<string, unknown>> => {
  const url = opts?.url?.trim() || EXAMPLE;
  const seconds = Math.min(Math.max(opts?.seconds ?? DEFAULT_SECONDS, 1), 60);
  const started = Date.now();

  let chromium: PlaywrightChromium;
  try {
    chromium = await loadChromium();
  } catch (error) {
    return { ok: false, url, chromium: "n/a", error: String(error) };
  }

  const chromiumPath = chromiumApi.resolve();
  const extensionsInput = opts?.extensions && opts.extensions.length > 0 ? opts.extensions : chromiumApi.extensions();
  const extensions = extensionsInput.filter(chromiumApi.exists);
  const headless = (opts?.headless ?? false) && extensions.length === 0;

  // No bundled/explicit Chromium -> use Playwright's registry build for the
  // installed package. `deno install` doesn't download browsers, so download
  // (once) via that package's own CLI instead of failing with
  // "Executable doesn't exist .../ms-playwright/chromium-<rev>".
  if (!chromiumPath) {
    const registry = chromium.executablePath();
    if (registry && !existsPath(registry)) {
      try {
        await ensurePlaywrightBrowser("chromium");
      } catch (error) {
        const msg = String(error);
        return {
          ok: false,
          url,
          chromium: "playwright-registry",
          error: msg,
          hint: Deno.build.os === "windows" && /spawn|Invalid handle/i.test(msg)
            ? "Windows blocked the browser download/launch. Disable Smart App Control temporarily (Windows Security -> App & browser control -> Smart App Control -> Off), retry, then re-enable it. Alternative: run 'npx playwright install chromium' in your terminal."
            : "Run in your terminal: npx playwright install chromium",
        };
      }
    }
  }

  let browser: unknown;
  try {
    if (extensions.length > 0) {
      const profile = await Deno.makeTempDir({ prefix: "deskapp-ext-" });
      const context = await chromium.launchPersistentContext(profile, {
        headless: false,
        executablePath: chromiumPath,
        args: extensionArgs(extensions),
      });
      browser = context;
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const title = await page.title();
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return {
        ok: true,
        url,
        title,
        seconds,
        headless: false,
        chromium: chromiumPath ?? "playwright-registry",
        extensions: extensions.map((e) => basename(e)),
        durationMs: Date.now() - started,
        closed: true,
      };
    }

    const launchBrowser = chromiumPath ? await chromium.launch({ headless, executablePath: chromiumPath }) : await chromium.launch({ headless });
    browser = launchBrowser;
    const page = await launchBrowser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return {
      ok: true,
      url,
      title,
      seconds,
      headless,
      chromium: chromiumPath ?? "playwright-registry",
      extensions: [],
      durationMs: Date.now() - started,
      closed: true,
    };
  } catch (error) {
    return { ok: false, url, chromium: chromiumPath ?? "playwright-registry", error: String(error) };
  } finally {
    const b = browser as { close?: () => Promise<void>; } | undefined;
    await b?.close();
  }
};

export const handlers = { play };