// ./src/core/api/registry.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const handlers: Record<string, Function> = {};
  const onHandlers: Record<string, Function> = {};
  const ipcMain = {
    handle: vi.fn((ch: string, fn: Function) => {
      handlers[ch] = fn;
    }),
    on: vi.fn((ch: string, fn: Function) => {
      onHandlers[ch] = fn;
    }),
    removeHandler: vi.fn(),
  };
  return { handlers, onHandlers, ipcMain };
});

vi.mock("electron", () => ({ ipcMain: mocks.ipcMain }));
vi.mock("@/core/api/bindings.generated", () => ({
  GENERATED_CONTROLLERS: [
    {
      module: "app",
      controller: "demo",
      mod: {
        handlers: {
          ping: () => "pong",
          add: (a: number, b: number) => a + b,
          boom: () => {
            throw { status: 422, message: "nope", errors: { fieldErrors: { email: ["bad"] } } };
          },
        },
      },
    },
    { module: "app", controller: "empty", mod: {} },
  ],
}));

import { bindAll, collectHandlers } from "@/core/api/registry";

describe("api registry", () => {
  beforeEach(() => {
    for (const k of Object.keys(mocks.handlers)) delete mocks.handlers[k];
    for (const k of Object.keys(mocks.onHandlers)) delete mocks.onHandlers[k];
    vi.clearAllMocks();
  });

  it("collectHandlers flattens generated controller handlers", () => {
    const map = collectHandlers();
    expect([...map.keys()].sort()).toEqual(["app.demo.add", "app.demo.boom", "app.demo.ping"]);
    expect(map.get("app.demo.ping")?.()).toBe("pong");
  });

  it("bindAll registers ipc handlers and __list__", async () => {
    bindAll();
    expect(mocks.ipcMain.handle).toHaveBeenCalled();
    expect(mocks.handlers["deskapp:app.demo.ping"]).toBeTypeOf("function");
    const res = await mocks.handlers["deskapp:app.demo.add"]({}, 2, 3);
    expect(res).toBe(5);

    const event: any = {};
    mocks.onHandlers["deskapp:__list__"](event);
    expect((event.returnValue as string[]).sort()).toEqual(["app.demo.add", "app.demo.boom", "app.demo.ping"]);

    const list = await mocks.handlers["deskapp:__list__"]({});
    expect((list as string[]).sort()).toEqual(["app.demo.add", "app.demo.boom", "app.demo.ping"]);
  });

  it("wraps a thrown handler error in the tagged envelope (survives IPC)", async () => {
    bindAll();
    const res: any = await mocks.handlers["deskapp:app.demo.boom"]({});
    expect(res.__deskappError).toBe(true);
    expect(res.status).toBe(422);
    expect(res.message).toBe("nope");
    expect(res.errors).toEqual({ fieldErrors: { email: ["bad"] } });
  });
});
