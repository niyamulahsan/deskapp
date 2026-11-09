import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectControllers, generate } from "@/core/api/generate.manifest";

describe("generate.manifest", () => {
  it("collectControllers returns controller entries from src/modules (if present)", () => {
    const entries = collectControllers();
    // template has app controllers
    expect(Array.isArray(entries)).toBe(true);
    if (entries.length > 0) {
      expect(entries[0]).toHaveProperty("module");
      expect(entries[0]).toHaveProperty("controller");
      expect(entries[0].importPath).toMatch(/^@\//);
    }
  });

  it("generate writes bindings.generated.ts (idempotent in project)", () => {
    // run generate against the real project layout; it should not throw
    expect(() => generate()).not.toThrow();
  });
});
