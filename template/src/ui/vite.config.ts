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
      "@/ui": new URL("src/", import.meta.url).pathname,
      "@": new URL("src/", import.meta.url).pathname,
    },
  },
  server: {
    // Allow serving the shared icon folder at the project root (src/icons)
    // alongside the ui package root.
    fs: {
      allow: [new URL("../..", import.meta.url).pathname],
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
