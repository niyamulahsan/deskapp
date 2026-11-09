import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@config": fileURLToPath(new URL("./src/config", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@/ui": fileURLToPath(new URL("./src/ui/src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["src/ui/**", "src/storage/**", "node_modules/**", "dist/**", "out/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/ui/**",
        "src/storage/**",
        "src/core/maker/**",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
      ],
      // No thresholds in the template config (keeps scaffolded projects from failing
      // on first run with partial coverage). Enforce floors in CI/locally via CLI
      // flags when needed.
    },
  },
});
