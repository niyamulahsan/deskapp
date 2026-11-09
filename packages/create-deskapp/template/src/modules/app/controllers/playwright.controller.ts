import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { chromium as chromiumApi } from "@/core/facade";
import { ensurePlaywrightBrowser, existsPath } from "@/core/utils/playwright";

const PW_SPEC = "playwright";
const NEED_PLAYWRIGHT = '"playwright" is not installed. Run "npm install playwright".';

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
  try {
    const mod = (await import(PW_SPEC)) as { chromium?: PlaywrightChromium };
    if (!mod.chromium) throw new Error(NEED_PLAYWRIGHT);
    return mod.chromium;
  } catch (error) {
    throw new Error(`${String(error)} - ${NEED_PLAYWRIGHT}`);
  }
}

const EXAMPLE = "https://example.com";
const DEFAULT_SECONDS = 5;

function extensionArgs(extensions: string[]): string[] {
  return ["--disable-extensions-except=" + extensions.join(","), ...extensions.map((e) => `--load-extension=${e}`)];
}

export const play = async (opts?: {
  url?: string;
  seconds?: number;
  headless?: boolean;
  extensions?: string[];
}): Promise<Record<string, unknown>> => {
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
          hint:
            process.platform === "win32" && /spawn|Invalid handle/i.test(msg)
              ? "Windows blocked the browser. Run 'npx playwright install chromium' in your terminal."
              : "Run in your terminal: npx playwright install chromium"
        };
      }
    }
  }

  let browser: unknown;
  try {
    if (extensions.length > 0) {
      // Create a temp dir using Node's os module
      const profile = await mkdtemp(join(tmpdir(), "deskapp-ext-"));
      const context = await chromium.launchPersistentContext(profile, {
        headless: false,
        executablePath: chromiumPath,
        args: extensionArgs(extensions)
      });
      browser = context;
      const page = context.pages()[0] ?? (await context.newPage());
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
        closed: true
      };
    }

    const launchBrowser = chromiumPath
      ? await chromium.launch({ headless, executablePath: chromiumPath })
      : await chromium.launch({ headless });
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
      closed: true
    };
  } catch (error) {
    return { ok: false, url, chromium: chromiumPath ?? "playwright-registry", error: String(error) };
  } finally {
    const b = browser as { close?: () => Promise<void> } | undefined;
    await b?.close();
  }
};

export const handlers = { play };
