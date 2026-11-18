import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import waitOnPkg from "wait-on";

const waitOn = typeof waitOnPkg === "function" ? waitOnPkg : waitOnPkg.default;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

loadDotenv({ path: path.join(root, ".env") });

const port = process.env.VITE_DEV_PORT || "5173";

await waitOn({
  resources: [`tcp:${port}`, path.join(root, "out", "main", "index.cjs")]
});

const electron = spawn("npx", ["electron", path.join(root, "out", "main", "index.cjs")], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, NODE_ENV: "development" }
});

electron.on("close", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  electron.kill();
  process.exit(0);
});
