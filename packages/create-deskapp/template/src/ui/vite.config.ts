import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  define: {
    __SOCKET_ENABLED__: JSON.stringify(
      !!process.env.VITE_SOCKET_URL || !!process.env.VITE_API_URL
    ),
  },
  resolve: {
    alias: {
      "@/ui": fileURLToPath(new URL("src/", import.meta.url)),
      "@": fileURLToPath(new URL("src/", import.meta.url)),
    },
  },
  server: {
    // Allow serving the shared icon folder at the project root (src/icons)
    // alongside the ui package root.
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))],
    },
    proxy: {
      "/__invoke": "http://localhost:8000",
      "/__bindings": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
