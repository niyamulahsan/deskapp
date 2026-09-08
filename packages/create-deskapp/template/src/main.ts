import { fromFileUrl, join, resolve } from "@std/path";
import { serveDir } from "@std/http/file-server";
import { db, cron, win, chrome } from "@/core/facade.ts";
import { storage } from "@/core/utils/storage.ts";
import { bindAll } from "@/core/api/registry.ts";
import { config } from "@/core/config.ts";
import { windows } from "@/window/config.ts";

// In a packaged desktop build the embedded `--include` assets live in the
// binary's virtual filesystem, NOT relative to Deno.cwd(). Resolve them from
// import.meta (which maps into that VFS); fall back to the dev layout where
// the UI is on disk next to the sources. Returns undefined when no UI was
// bundled (headless builds) - same idea as engine's hasFrontendBuild().
function resolveDistPath(): string | undefined {
  const candidates: string[] = [
    fromFileUrl(new URL("./ui/dist/", import.meta.url)),
    resolve(Deno.cwd(), "src", "ui", "dist"),
  ];
  for (const candidate of candidates) {
    try {
      if (Deno.statSync(candidate).isDirectory) return candidate;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

const DIST_PATH = resolveDistPath();

export async function handler(req: Request): Promise<Response> {
  // Headless: no embedded UI. Serve a small JSON status instead (the process
  // keeps running in the tray as a background service).
  if (!DIST_PATH) {
    if (req.method === "GET") {
      return Response.json({ app: config.appName, ui: false, status: "ok" });
    }
    return new Response("Not found", { status: 404 });
  }

  const response = await serveDir(req, {
    fsRoot: DIST_PATH,
    showIndex: true, // Serves index.html for directories
  });

  if (response.status === 404) {
    try {
      const index = Deno.readFileSync(join(DIST_PATH, "index.html"));
      return new Response(index, {
        headers: {
          "content-type": "text/html",
          "cache-control": "no-cache" // Optional for development
        },
      });
    } catch {
      return new Response(
        "<!doctype html><title>Deskapp</title><p>UI not built. Run <code>deno task maker build</code>.</p>",
        { headers: { "content-type": "text/html" } },
      );
    }
  }

  return response;
}

if (import.meta.main) {
  Deno.serve(handler);

  const addr = Deno.env.get("DENO_SERVE_ADDRESS");
  if (addr) console.log(`[desktop] http://127.0.0.1:${addr.split(":").pop()}`);

  // Boot the local stack: open the SQLite database before serving requests.
  console.log("[desktop] booting local stack (db)");
  await db.init();

  // Prepare the storage disks (src/storage/app/{public,private,tmp}).
  await storage.init();

  const uiEnabled = config.ui.enabled && DIST_PATH !== undefined;

  if (uiEnabled) {
    // Bind framework handlers into the webview so the frontend can call them
    // in-process via `bindings` (no HTTP/IPC). Only runs under `deno desktop`.
    // Create one window per entry in src/window/config.ts: the first is the
    // main window, every extra entry opens an independent window.
    let isMain = true;
    for (const [name, preset] of Object.entries(windows)) {
      const created = win.createWindow(preset, name);
      if (!created) continue;
      try {
        await bindAll(created);
      } catch (error) {
        console.error(`[desktop] failed to bind handlers (${name})`, error);
      }
      // Default app menu + tray are attached to the main window at startup.
      // Opt out per-window with `chrome: false` in src/window/config.ts.
      if (isMain && preset.chrome !== false) chrome.setupDesktopChrome(created);
      isMain = false;
      if (preset.route) {
        const port = Deno.env.get("DENO_SERVE_ADDRESS")?.split(":").pop();
        if (port) created.navigate(`http://127.0.0.1:${port}${preset.route}`);
      }
    }
  } else {
    // Headless / tray mode: no webview UI, no bindings. Adopt the implicit
    // startup window and hide it (documented Deno Desktop tray-only pattern)
    // so the process runs as a background service. The tray keeps the process
    // alive and offers Quit; the HTTP server serves the JSON status. Same feel
    // as engine running API-only without a frontend.
    console.log("[desktop] headless mode - no UI, running in the tray");
    const hidden = win.createWindow(windows.main);
    if (hidden) {
      hidden.hide();
      for (let i = 0; i < 15 && hidden.isVisible(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        hidden.hide();
      }
      // Some Deno Desktop versions re-show the hidden implicit window on
      // Windows; park it far off-screen as a belt-and-braces measure so it
      // never appears on the user's desktop.
      try {
        hidden.setPosition(-32000, -32000);
        hidden.setSize(0, 0);
      } catch {
        // position/size unavailable - ignore
      }
      console.log(`[desktop] headless window hidden: ${!hidden.isVisible()}`);
    } else {
      console.log("[desktop] headless: no window to hide");
    }
    chrome.hideDock();
    chrome.createHeadlessTray();
  }

  const shutdown = () => {
    db.close();
    cron.stop();
    Deno.exit(0);
  };

  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);
}
