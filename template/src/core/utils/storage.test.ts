import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir(), getAppPath: () => os.tmpdir(), isPackaged: false },
}));
vi.mock("@/core/env", () => ({
  appBaseDir: () => process.env.__TEST_APP_BASE__ || os.tmpdir(),
}));

import { files, storage } from "@/core/utils/storage";

describe("files (storage utils)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "deskapp-storage-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("ensureDir/pathExists/isFile/isDirectory work", async () => {
    const sub = path.join(dir, "a", "b");
    expect(await files.pathExists(sub)).toBe(false);
    await files.ensureDir(sub);
    expect(await files.pathExists(sub)).toBe(true);
    expect(await files.isDirectory(sub)).toBe(true);
    expect(await files.isFile(sub)).toBe(false);
    const f = path.join(sub, "x.txt");
    await fs.writeFile(f, "hi");
    expect(await files.isFile(f)).toBe(true);
  });

  it("fileMeta returns info or null", async () => {
    const f = path.join(dir, "m.txt");
    await fs.writeFile(f, "abc");
    const meta = await files.fileMeta(f);
    expect(meta?.isFile).toBe(true);
    expect(meta?.size).toBe(3);
    expect(await files.fileMeta(path.join(dir, "nope"))).toBeNull();
  });

  it("listFiles/listDirectories return sorted names", async () => {
    await fs.writeFile(path.join(dir, "b.txt"), "");
    await fs.writeFile(path.join(dir, "a.txt"), "");
    await fs.mkdir(path.join(dir, "zdir"));
    await fs.mkdir(path.join(dir, "adir"));
    expect((await files.listFiles(dir)).map((p) => path.basename(p))).toEqual(["a.txt", "b.txt"]);
    expect((await files.listDirectories(dir)).map((p) => path.basename(p))).toEqual(["adir", "zdir"]);
  });

  it("read/write text/json/binary helpers", async () => {
    const t = path.join(dir, "t.txt");
    await files.writeTextFile(t, "hello");
    expect(await files.readTextFile(t)).toBe("hello");
    expect(await files.readTextFileOr(path.join(dir, "missing"), "fb")).toBe("fb");

    const j = path.join(dir, "j.json");
    await files.writeJson(j, { a: 1 });
    expect(await files.readJson(j, null)).toEqual({ a: 1 });
    expect(await files.readJson(path.join(dir, "bad.json"), { d: 1 })).toEqual({ d: 1 });

    const b = path.join(dir, "b.bin");
    await files.writeBinaryFile(b, new Uint8Array([1, 2, 3]));
    const buf = await files.readBinaryFile(b);
    expect([...buf]).toEqual([1, 2, 3]);
  });

  it("copy/move/remove/uniquePath/upload", async () => {
    const src = path.join(dir, "src.txt");
    await fs.writeFile(src, "data");
    const dst = path.join(dir, "nested", "dst.txt");
    await files.copyFile(src, dst);
    expect(await fs.readFile(dst, "utf8")).toBe("data");

    const moved = path.join(dir, "moved.txt");
    await files.moveFile(dst, moved);
    expect(await files.pathExists(moved)).toBe(true);
    expect(await files.pathExists(dst)).toBe(false);

    await files.removePath(moved);
    expect(await files.pathExists(moved)).toBe(false);
    await files.removePath(path.join(dir, "nope")); // missing-safe

    await fs.writeFile(path.join(dir, "f.txt"), "x");
    const u = await files.uniquePath(dir, "f.txt");
    expect(path.basename(u)).toMatch(/f \(\d+\)\.txt/);

    const upDest = path.join(dir, "uploads");
    const up = await files.uploadFile(src, upDest);
    expect(await files.pathExists(up)).toBe(true);
  });

  it("downloadFile copies local files and rejects bad schemes", async () => {
    const src = path.join(dir, "dl-src.txt");
    await fs.writeFile(src, "payload");
    const dst = path.join(dir, "out", "dl.txt");
    await files.downloadFile(src, dst);
    expect(await fs.readFile(dst, "utf8")).toBe("payload");

    await expect(files.downloadFile("ftp://example.com/x", path.join(dir, "x"))).rejects.toThrow(/not supported/i);
  });
});

describe("storage facade (app-managed)", () => {
  let base: string;
  beforeEach(async () => {
    base = await fs.mkdtemp(path.join(os.tmpdir(), "deskapp-appstore-"));
    process.env.__TEST_APP_BASE__ = base;
    process.env.APP_DATA_DIR = path.join(base, "data");
    await storage.init();
  });
  afterEach(async () => {
    delete process.env.__TEST_APP_BASE__;
    delete process.env.APP_DATA_DIR;
    await fs.rm(base, { recursive: true, force: true });
  });

  it("put/get/exists/missing/size/delete on default disk", async () => {
    await storage.put("samples/a.txt", "hello");
    expect(await storage.exists("samples/a.txt")).toBe(true);
    expect(await storage.missing("samples/a.txt")).toBe(false);
    expect((await storage.get("samples/a.txt")).toString()).toBe("hello");
    expect(await storage.size("samples/a.txt")).toBe(5);
    await storage.delete("samples/a.txt");
    expect(await storage.exists("samples/a.txt")).toBe(false);
  });

  it("copy/move/files/directories/make/deleteDirectory", async () => {
    await storage.put("d1/a.txt", "a");
    await storage.makeDirectory("d2");
    await storage.copy("d1/a.txt", "d2/b.txt");
    expect(await storage.exists("d2/b.txt")).toBe(true);
    await storage.move("d2/b.txt", "d2/c.txt");
    expect(await storage.missing("d2/b.txt")).toBe(true);
    expect((await storage.files("d1"))).toContain("d1/a.txt");
    expect((await storage.directories(""))).toEqual(expect.arrayContaining(["d1", "d2"]));
    await storage.deleteDirectory("d2");
    expect(await storage.missing("d2/c.txt")).toBe(true);
  });

  it("streams and url/path helpers", async () => {
    await storage.put("s.txt", "stream");
    const rs = await storage.readStream("s.txt");
    const reader = rs.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    expect(Buffer.concat(chunks).toString()).toBe("stream");

    const ws = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("ws"));
        c.close();
      },
    });
    await storage.writeStream("w.txt", ws);
    expect((await storage.get("w.txt")).toString()).toBe("ws");
    expect(storage.disk("private").path("w.txt")).toContain("w.txt");
    expect(storage.url("w.txt").startsWith("file:")).toBe(true);
  });

  it("generateForDownload/consumeGenerated and download()", async () => {
    const name = await storage.generateForDownload({ prefix: "rep", extension: "txt", data: "body" });
    expect(name.replace(/\\/g, "/")).toContain("generated/");
    const bytes = await storage.consumeGenerated(name);
    expect(bytes.toString()).toBe("body");
    expect(await storage.disk("tmp").missing(name)).toBe(true);

    await storage.put("dl.txt", "hi");
    const res = await storage.download(null, "dl.txt", "x.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("x.txt");
    expect(await res.text()).toBe("hi");
  });
});
