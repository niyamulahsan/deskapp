import path from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const rootDir = typeof import.meta.dirname === "string"
  ? import.meta.dirname
  : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Use path.resolve for bulletproof Windows support
  root: path.resolve(rootDir, "."),
  plugins: [vue()],
  base: "./",
  define: {
    __SOCKET_ENABLED__: JSON.stringify(!!process.env.VITE_SOCKET_URL || !!process.env.VITE_API_URL),
  },
  resolve: {
    alias: {
      "@/ui": path.resolve(rootDir, "./src"),
      "@": path.resolve(rootDir, "../../src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(rootDir, "../..")],
    },
    proxy: {
      "/__invoke": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
