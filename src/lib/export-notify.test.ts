import { describe, expect, it, vi } from "vitest";
import {
  bundleExportDoneMessage,
  clearExportProgress,
  exportProgressFraction,
  notifyExportDone,
  reportExportIndeterminate,
  reportExportProgress,
  stoppedExportMessage,
} from "./export-notify";

describe("exportProgressFraction", () => {
  it("maps done/total onto 0..1", () => {
    expect(exportProgressFraction(3, 24)).toBeCloseTo(0.125);
    expect(exportProgressFraction(0, 10)).toBe(0);
    expect(exportProgressFraction(10, 10)).toBe(1);
  });

  it("clamps over/underflow and rejects unusable input", () => {
    expect(exportProgressFraction(-1, 10)).toBe(0);
    expect(exportProgressFraction(12, 10)).toBe(1);
    expect(exportProgressFraction(1, 0)).toBeNull();
    expect(exportProgressFraction(NaN, 10)).toBeNull();
  });
});

describe("bundleExportDoneMessage", () => {
  it("covers success, total failure, and partial bundles", () => {
    expect(bundleExportDoneMessage(24, 0, 24).title).toBe("Export complete");
    expect(bundleExportDoneMessage(0, 24, 24).title).toBe("Export failed");
    const partial = bundleExportDoneMessage(20, 4, 24);
    expect(partial.title).toBe("Partial export");
    expect(partial.body).toContain("-partial-");
  });
});

describe("stoppedExportMessage", () => {
  it("distinguishes partial saves from clean stops", () => {
    expect(stoppedExportMessage(5).body).toContain("partial bundle");
    expect(stoppedExportMessage(0).body).toContain("No screenshots");
  });
});

describe("bridge reporters", () => {
  it("are safe no-ops without the Electron bridge and forward with it", () => {
    // No window.storeshot in the node test env — must not throw.
    expect(() => reportExportProgress(1, 2)).not.toThrow();
    expect(() => reportExportIndeterminate()).not.toThrow();
    expect(() => clearExportProgress()).not.toThrow();
    expect(() => notifyExportDone({ title: "t", body: "b" })).not.toThrow();

    const bridge = {
      reportExportProgress: vi.fn(),
      clearExportProgress: vi.fn(),
      notifyExportDone: vi.fn(),
    };
    vi.stubGlobal("window", { storeshot: bridge });
    try {
      reportExportProgress(1, 4);
      expect(bridge.reportExportProgress).toHaveBeenCalledWith(0.25);
      reportExportIndeterminate();
      expect(bridge.reportExportProgress).toHaveBeenCalledWith(2);
      clearExportProgress();
      expect(bridge.clearExportProgress).toHaveBeenCalledTimes(1);
      notifyExportDone({ title: "t", body: "b" });
      expect(bridge.notifyExportDone).toHaveBeenCalledWith("t", "b");
      // Empty copy never reaches the bridge.
      notifyExportDone({ title: "", body: "" });
      expect(bridge.notifyExportDone).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
