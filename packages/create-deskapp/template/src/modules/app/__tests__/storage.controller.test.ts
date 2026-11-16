import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const files = {
    readBinaryFile: vi.fn(async () => Buffer.from("hello")),
    fileMeta: vi.fn(async () => ({ size: 5, isFile: true, modifiedAt: new Date(0) })),
    pathExists: vi.fn(async () => false),
    writeTextFile: vi.fn(async () => undefined),
    uploadFile: vi.fn(async () => "/uploads/f.txt"),
    downloadFile: vi.fn(async (_s: string, d: string) => d),
    removePath: vi.fn(async () => undefined),
    listFiles: vi.fn(async () => ["a"]),
    listDirectories: vi.fn(async () => ["d"]),
  };
  const pickers = {
    open: vi.fn(async () => "/src.txt"),
    save: vi.fn(async () => "/dst.txt"),
    folder: vi.fn(async () => "/dir"),
  };
  const storage = {
    init: vi.fn(async () => undefined),
    put: vi.fn(async () => "k"),
    get: vi.fn(async () => Buffer.from('{"a":1}')),
    exists: vi.fn(async () => false),
    files: vi.fn(async () => ["f"]),
    directories: vi.fn(async () => ["d"]),
    generateForDownload: vi.fn(async () => "generated/x"),
    consumeGenerated: vi.fn(async () => Buffer.from("gen")),
    delete: vi.fn(async () => undefined),
    disk: vi.fn(() => ({ path: vi.fn(() => "/private") })),
  };
  return { files, pickers, storage };
});

vi.mock("@/core/facade", () => ({ files: mocks.files, pickers: mocks.pickers, storage: mocks.storage }));
vi.mock("node:fs", () => ({ default: { existsSync: () => true } }));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, default: actual, mkdtemp: vi.fn(async () => "/tmp/t") };
});
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, default: { ...actual, tmpdir: () => "/tmp" }, tmpdir: () => "/tmp" };
});

import * as ctrl from "@/modules/app/controllers/storage.controller";

describe("app storage.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pickers.open.mockReset().mockResolvedValue("/src.txt");
    mocks.pickers.save.mockReset().mockResolvedValue("/dst.txt");
    mocks.pickers.folder.mockReset().mockResolvedValue("/dir");
    mocks.files.downloadFile.mockReset().mockImplementation(async (_s: string, d: string) => d);
    mocks.files.uploadFile.mockReset().mockResolvedValue("/uploads/f.txt");
    mocks.files.removePath.mockReset().mockResolvedValue(undefined);
    mocks.files.listFiles.mockReset().mockResolvedValue(["a"]);
    mocks.files.listDirectories.mockReset().mockResolvedValue(["d"]);
    mocks.files.readBinaryFile.mockReset().mockResolvedValue(Buffer.from("hello"));
    mocks.files.fileMeta.mockReset().mockResolvedValue({ size: 5, isFile: true, modifiedAt: new Date(0) } as any);
    mocks.files.pathExists.mockReset().mockResolvedValue(false);
    mocks.files.writeTextFile.mockReset().mockResolvedValue(undefined);
    mocks.storage.disk.mockReset().mockReturnValue({ path: vi.fn(() => "/private") } as any);
  });

  it("exposes handlers", () => {
    expect(ctrl.handlers.open).toBe(ctrl.open);
    expect(ctrl.handlers.appSave).toBe(ctrl.appSave);
  });

  it("open/save cancel and success paths", async () => {
    mocks.pickers.open.mockResolvedValueOnce(null);
    expect(await ctrl.open()).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.open.mockResolvedValue("/src.txt");
    expect(await ctrl.open()).toMatchObject({ ok: true, path: "/src.txt" });

    mocks.pickers.save.mockResolvedValueOnce(null);
    expect(await ctrl.save()).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.save.mockResolvedValue("/dst.txt");
    expect(await ctrl.save()).toMatchObject({ ok: true, path: "/dst.txt" });
  });

  it("upload/download/remove/list", async () => {
    mocks.pickers.open.mockResolvedValueOnce(null);
    expect(await ctrl.upload()).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.open.mockResolvedValueOnce("/src.txt");
    expect(await ctrl.upload()).toMatchObject({ ok: true, dest: "/uploads/f.txt" });

    mocks.pickers.save.mockResolvedValueOnce(null);
    expect(await ctrl.download("https://example.com/file.txt")).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.save.mockResolvedValueOnce("/dst.txt");
    expect(await ctrl.download("https://example.com/file.txt")).toMatchObject({ ok: true });

    mocks.pickers.open.mockResolvedValueOnce(null);
    expect(await ctrl.remove()).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.open.mockResolvedValue("/src.txt");
    expect(await ctrl.remove()).toMatchObject({ ok: true });

    mocks.pickers.folder.mockResolvedValueOnce(null);
    expect(await ctrl.list()).toMatchObject({ ok: false, error: "cancelled" });
    mocks.pickers.folder.mockResolvedValueOnce("/dir");
    expect(await ctrl.list()).toMatchObject({ ok: true, files: ["a"] });
  });

  it("app-managed helpers", async () => {
    expect(await ctrl.appSave({})).toMatchObject({ ok: true });
    expect(await ctrl.appLoad()).toMatchObject({ ok: true });
    expect(await ctrl.appList()).toMatchObject({ ok: true });
    expect(await ctrl.appExport({})).toMatchObject({ ok: true });
    expect(await ctrl.appDelete()).toMatchObject({ ok: true });
  });
});
