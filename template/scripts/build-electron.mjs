import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node20",
  alias: {
    "@/ui": path.resolve(root, "src/ui/src"),
    "@config": path.resolve(root, "src/config"),
    "@": path.resolve(root, "src")
  },
  // Keep Electron and native/runtime-loaded deps external.
  external: ["electron", "@libsql/client", "drizzle-orm", "playwright", "playwright-core", "chromium-bidi"],
  logLevel: "info"
};

async function run() {
  const mainOpts = {
    ...shared,
    entryPoints: [path.resolve(root, "src/main.ts")],
    outfile: path.resolve(root, "out/main/index.cjs")
  };
  const preloadOpts = {
    ...shared,
    entryPoints: [path.resolve(root, "src/preload.ts")],
    outfile: path.resolve(root, "out/preload/index.cjs")
  };

  if (watch) {
    const [mainCtx, preloadCtx] = await Promise.all([esbuild.context(mainOpts), esbuild.context(preloadOpts)]);
    await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
    console.log("[electron] watching main & preload...");
    // Keep process alive
    process.on("SIGINT", async () => {
      await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
      process.exit(0);
    });
  } else {
    await Promise.all([esbuild.build(mainOpts), esbuild.build(preloadOpts)]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
