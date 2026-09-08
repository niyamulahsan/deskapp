import { chromium } from "playwright";
import { basename } from "@std/path";
import { chromium as chromiumApi } from "@/core/facade.ts";

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

  const chromiumPath = chromiumApi.resolve();
  const extensionsInput = opts?.extensions && opts.extensions.length > 0 ? opts.extensions : chromiumApi.extensions();
  const extensions = extensionsInput.filter(chromiumApi.exists);
  const headless = (opts?.headless ?? false) && extensions.length === 0;

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