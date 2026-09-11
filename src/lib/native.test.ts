import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ackFlush,
  getLastExportPath,
  isMacShell,
  isShell,
  onExportSaved,
  onMenuAction,
  reportWorkspace,
  revealLastExport,
  revealPath,
  setDocumentState,
  toggleTheme,
  trackExportSaves,
} from "./native";

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
});

describe("shell detection", () => {
  it("reports no shell in plain web/node environments", () => {
    expect(isShell()).toBe(false);
    expect(isMacShell()).toBe(false);
  });
});

describe("bridge helpers without a bridge", () => {
  it("never throw and resolve false/null", async () => {
    expect(() => setDocumentState(true, "t")).not.toThrow();
    expect(() => ackFlush()).not.toThrow();
    expect(() => reportWorkspace("/tmp/ws")).not.toThrow();
    expect(() => trackExportSaves()).not.toThrow();
    expect(() => revealLastExport()).not.toThrow();
    expect(getLastExportPath()).toBeNull();
    await expect(revealPath("/tmp/ws")).resolves.toBe(false);
    expect(onMenuAction(() => {})).toEqual(expect.any(Function));
    expect(onExportSaved(() => {})).toEqual(expect.any(Function));
  });
});

describe("bridge helpers with a fake bridge", () => {
  function installFakeWindow(platform: string) {
    const dispatched: Event[] = [];
    const menuListeners: ((action: string, payload?: unknown) => void)[] = [];
    const bridge = {
      platform,
      pickWorkspace: vi.fn(async () => null),
      onMenuAction: vi.fn((cb: (action: string, payload?: unknown) => void) => {
        menuListeners.push(cb);
        return () => {};
      }),
      setDocumentState: vi.fn(),
      ackFlush: vi.fn(),
      reportWorkspace: vi.fn(),
      revealPath: vi.fn(async () => true),
      onExportSaved: vi.fn((cb: (path: string) => void) => {
        (bridge as { lastCb?: (path: string) => void }).lastCb = cb;
        return () => {};
      }),
    };
    (globalThis as Record<string, unknown>).window = {
      storeshot: bridge,
      localStorage: { setItem: vi.fn(), getItem: () => null },
      dispatchEvent: (e: Event) => {
        dispatched.push(e);
        return true;
      },
    };
    (globalThis as Record<string, unknown>).document = {
      documentElement: {
        classList: { toggle: vi.fn(), contains: () => false },
      },
    };
    const emitMenu = (action: string, payload?: unknown) => {
      for (const cb of menuListeners) cb(action, payload);
    };
    const emitSaved = (path: string) => {
      (bridge as { lastCb?: (path: string) => void }).lastCb?.(path);
    };
    return { bridge, dispatched, emitMenu, emitSaved };
  }

  it("detects the macOS shell and forwards calls", async () => {
    const { bridge } = installFakeWindow("darwin");
    expect(isShell()).toBe(true);
    expect(isMacShell()).toBe(true);
    setDocumentState(true, "Doc — StoreShot");
    expect(bridge.setDocumentState).toHaveBeenCalledWith({ dirty: true, title: "Doc — StoreShot" });
    reportWorkspace("/tmp/ws");
    expect(bridge.reportWorkspace).toHaveBeenCalledWith("/tmp/ws");
    await expect(revealPath("/tmp/ws")).resolves.toBe(true);
    ackFlush();
    expect(bridge.ackFlush).toHaveBeenCalledTimes(1);
  });

  it("routes menu actions to subscribers", () => {
    const { emitMenu } = installFakeWindow("darwin");
    const seen: [string, unknown?][] = [];
    onMenuAction((action, payload) => {
      seen.push([action, payload]);
    });
    emitMenu("save");
    emitMenu("open-workspace-path", "/tmp/ws");
    expect(seen).toEqual([
      ["save", undefined],
      ["open-workspace-path", "/tmp/ws"],
    ]);
  });

  it("records export-saved paths and toggles the theme", () => {
    const { dispatched, emitSaved } = installFakeWindow("linux");
    expect(isShell()).toBe(true);
    expect(isMacShell()).toBe(false);
    trackExportSaves();
    onExportSaved(() => {});
    emitSaved("/tmp/out.zip");
    expect(getLastExportPath()).toBe("/tmp/out.zip");
    toggleTheme();
    expect(dispatched.map((e) => e.type)).toContain("storeshot:theme-changed");
  });
});
