import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts
  });
  return child;
}

// 1) Build main+preload once, then watch
const build = run("node", [path.resolve(root, "scripts/build-electron.mjs"), "--watch"]);

let electron = null;
let started = false;

function startElectron() {
  if (started) return;
  started = true;
  const electronBin = path.resolve(root, "node_modules/electron/dist/electron.exe");
  const electronCmd = process.platform === "win32" && electronBin ? electronBin : "npx";
  const args =
    process.platform === "win32" && electronBin
      ? [path.resolve(root, "out/main/index.cjs")]
      : ["electron", path.resolve(root, "out/main/index.cjs")];

  electron = spawn(process.platform === "win32" && electronBin ? electronBin : "npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: !(process.platform === "win32" && electronBin),
    env: { ...process.env, NODE_ENV: "development" }
  });
  electron.on("close", (code) => {
    build.kill();
    process.exit(code ?? 0);
  });
}

// Wait for Vite (started by concurrently) and initial build - give esbuild a moment
setTimeout(startElectron, 2500);

process.on("SIGINT", () => {
  electron?.kill();
  build.kill();
  process.exit(0);
});
