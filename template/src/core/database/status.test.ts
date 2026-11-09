import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listMigrations } from "@/core/database/status";

describe("listMigrations", () => {
  it("returns [] for a missing directory", () => {
    expect(listMigrations(path.join(os.tmpdir(), "deskapp-no-such-migrations-dir"))).toEqual([]);
  });

  it("lists only .sql files sorted", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deskapp-migrations-"));
    fs.writeFileSync(path.join(dir, "0002_b.sql"), "");
    fs.writeFileSync(path.join(dir, "0001_a.sql"), "");
    fs.writeFileSync(path.join(dir, "meta.json"), "");
    expect(listMigrations(dir)).toEqual(["0001_a.sql", "0002_b.sql"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
