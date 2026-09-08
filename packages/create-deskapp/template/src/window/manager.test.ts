import { assertEquals } from "@std/assert";
import { win } from "./manager.ts";
import type { BrowserWindowOptions } from "./manager.ts";

// -- mock Deno.BrowserWindow ----------------------------------------------

type CloseHandler = (event: { target?: unknown; }) => void;

let fakeCounter = 0;

class FakeWindow {
  windowId = ++fakeCounter;
  private handlers = new Map<string, CloseHandler[]>();
  private closed = false;

  constructor(_options?: BrowserWindowOptions) { }

  addEventListener(type: string, handler: CloseHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  removeEventListener(type: string, handler: CloseHandler): void {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(type, list.filter((h) => h !== handler));
  }

  // Test helper: simulate the OS close button.
  emitClose(): void {
    this.closed = true;
    for (const handler of this.handlers.get("close") ?? []) handler({});
  }

  isClosed(): boolean {
    return this.closed;
  }

  show() { }
  hide() { }
  focus() { }
  navigate() { }
  bind() { }
  reload() { }
  close() {
    this.emitClose();
  }
  isVisible() {
    return !this.closed;
  }
  getSize(): [number, number] {
    return [0, 0];
  }
  setSize() { }
  getPosition(): [number, number] {
    return [0, 0];
  }
  setPosition() { }
  isResizable() {
    return true;
  }
  setResizable() { }
  isAlwaysOnTop() {
    return false;
  }
  setAlwaysOnTop() { }
  setTitle() { }
  setApplicationMenu() { }
  showContextMenu() { }
  executeJs() {
    return Promise.resolve(undefined);
  }
  openDevtools() { }
}

const denoShape = Deno as typeof Deno & {
  exit: (code?: number) => never;
  BrowserWindow?: new (options?: BrowserWindowOptions) => FakeWindow;
};

let exitCount = 0;

function installFakeWindows(): void {
  exitCount = 0;
  fakeCounter = 0;
  denoShape.BrowserWindow = FakeWindow;
  denoShape.exit = (): never => {
    exitCount += 1;
    return undefined as never;
  };
}

function restoreDeno(): void {
  delete denoShape.BrowserWindow;
  denoShape.exit = 0 as unknown as typeof denoShape.exit; // restore marker (real exit untestable)
}

function emitCloseOf(target: ReturnType<typeof win.createWindow>): void {
  (target as unknown as FakeWindow | undefined)?.emitClose();
}

// -- tests ----------------------------------------------------------------

Deno.test("closing the main window keeps the secondary window alive", () => {
  installFakeWindows();
  try {
    const main = win.createWindow(undefined, "main");
    const settings = win.createWindow(undefined, "settings");
    assertEquals(win.getWindowCount(), 2);
    assertEquals(win.getWindow(), main);

    emitCloseOf(main); // cross on main window
    assertEquals(win.getWindowCount(), 1);
    assertEquals(exitCount, 0); // app did NOT quit
    assertEquals(win.getWindow(), undefined); // main no longer tracked
    assertEquals(win.getWindow(settings?.windowId), settings);

    emitCloseOf(settings); // cross on settings = last window
    assertEquals(win.getWindowCount(), 0);
    assertEquals(exitCount, 1); // app quits on last window
  } finally {
    restoreDeno();
  }
});

Deno.test("closing a secondary window keeps the main window alive", () => {
  installFakeWindows();
  try {
    const main = win.createWindow(undefined, "main");
    const settings = win.createWindow(undefined, "settings");

    emitCloseOf(settings);
    assertEquals(win.getWindowCount(), 1);
    assertEquals(exitCount, 0); // app did NOT quit
    assertEquals(win.getWindow(), main); // main still tracked
  } finally {
    restoreDeno();
  }
});

Deno.test("closing the only (main) window quits the app", () => {
  installFakeWindows();
  try {
    const main = win.createWindow(undefined, "main");
    assertEquals(win.getWindowCount(), 1);

    emitCloseOf(main);
    assertEquals(win.getWindowCount(), 0);
    assertEquals(exitCount, 1); // last window closed => quit
  } finally {
    restoreDeno();
  }
});