// ./src/ui/vite.config.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const rootDir = typeof import.meta.dirname === "string" ? import.meta.dirname : path.dirname(fileURLToPath(import.meta.url));

// Vite's root is src/ui, but `.env` lives at the project root.
const projectRoot = path.resolve(rootDir, "../..");

export default defineConfig(({ mode }) => {
  // `loadEnv` reads `projectRoot/.env` (+ process env); `envDir` makes the same
  // file available to the client as `import.meta.env.VITE_*` (used by pulse).
  const env = loadEnv(mode, projectRoot, "VITE_");
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || "";

  return {
    // Use path.resolve for bulletproof Windows support
    root: path.resolve(rootDir, "."),
    envDir: projectRoot,
    plugins: [vue()],
    base: "./",
    define: {
      __SOCKET_ENABLED__: JSON.stringify(!!(env.VITE_SOCKET_URL || env.VITE_API_URL))
    },
    resolve: {
      alias: {
        "@/ui": path.resolve(rootDir, "./src"),
        "@": path.resolve(rootDir, "../../src")
      }
    },
    server: {
      port: 5173,
      strictPort: true,
      fs: {
        allow: [projectRoot]
      },
      proxy: {
        "/__invoke": "http://localhost:8000",
        // Dev-only convenience for the renderer-axios route: same-origin `/api`
        // calls are forwarded to the server so the browser cookie jar works
        // (no CORS). The recommended route calls `app.net.apiFetch` from the
        // main process instead and needs no proxy. Set VITE_API_URL to enable.
        ...(apiUrl ? { "/api": { target: apiUrl, changeOrigin: true } } : {})
      }
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
