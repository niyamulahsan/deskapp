import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverModelFiles, generateSchemaFile, walkTs } from "@/core/database/aggregate";

describe("database/aggregate", () => {
  it("walkTs collects .ts/.tsx files", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskapp-walk-"));
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "a.ts"), "export {};");
    fs.writeFileSync(path.join(dir, "sub", "b.tsx"), "export {};");
    fs.writeFileSync(path.join(dir, "c.txt"), "no");
    const out: string[] = [];
    walkTs(dir, out);
    expect(out.map((f) => path.basename(f)).sort()).toEqual(["a.ts", "b.tsx"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("generateSchemaFile writes schema for discovered models", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "deskapp-agg-"));
    const src = path.join(root, "src");
    const modelDir = path.join(src, "modules", "blog", "database", "models");
    fs.mkdirSync(modelDir, { recursive: true });
    fs.writeFileSync(path.join(modelDir, "post.model.ts"), "export const posts = 1;");
    const schemaPath = path.join(src, "database", "schema.ts");
    const found = generateSchemaFile(src, schemaPath);
    expect(found.length).toBe(1);
    const content = fs.readFileSync(schemaPath, "utf8");
    expect(content).toContain("export *");
    expect(content).toContain("GENERATED");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("generateSchemaFile emits empty export when no models", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "deskapp-agg-empty-"));
    const src = path.join(root, "src");
    fs.mkdirSync(src, { recursive: true });
    const schemaPath = path.join(src, "database", "schema.ts");
    const found = generateSchemaFile(src, schemaPath);
    expect(found).toEqual([]);
    expect(fs.readFileSync(schemaPath, "utf8")).toContain("export {};");
    fs.rmSync(root, { recursive: true, force: true });
  });
});
