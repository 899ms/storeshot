// Native export progress + completion notifications via the Electron bridge.
//
// macOS Notification Center banners cannot host a progress bar, so progress
// surfaces in the Dock icon (BrowserWindow.setProgressBar) while completion
// surfaces as a system notification. Every function here is a safe no-op on
// plain web builds where `window.storeshot` is absent.

export type ExportDoneMessage = { title: string; body: string };

/** Clamp a done/total pair to a 0..1 fraction, or null when unusable. */
export function exportProgressFraction(done: number, total: number): number | null {
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
  if (done <= 0) return 0;
  if (done >= total) return 1;
  return done / total;
}

/** Report determinate Dock progress. No-op outside Electron. */
export function reportExportProgress(done: number, total: number): void {
  const fraction = exportProgressFraction(done, total);
  if (fraction === null) return;
  try {
    window.storeshot?.reportExportProgress(fraction);
  } catch {
    // Bridge failures must never break an export.
  }
}

/** Switch the Dock bar to indeterminate mode (e.g. during the retry pass). */
export function reportExportIndeterminate(): void {
  try {
    window.storeshot?.reportExportProgress(2);
  } catch {
    // Bridge failures must never break an export.
  }
}

/** Clear the Dock progress bar. No-op outside Electron. */
export function clearExportProgress(): void {
  try {
    window.storeshot?.clearExportProgress();
  } catch {
    // Bridge failures must never break an export.
  }
}

/** Show a native completion notification. No-op outside Electron. */
export function notifyExportDone(message: ExportDoneMessage): void {
  if (!message.title || !message.body) return;
  try {
    window.storeshot?.notifyExportDone(message.title, message.body);
  } catch {
    // Bridge failures must never break an export.
  }
}

/** Bundle-export completion copy, mirroring the in-app toasts. */
export function bundleExportDoneMessage(
  okCount: number,
  failed: number,
  totalUnits: number,
): ExportDoneMessage {
  if (okCount > 0 && failed === 0) {
    return {
      title: "Export complete",
      body: `Exported ${okCount} PNG${okCount === 1 ? "" : "s"} — bundle downloaded.`,
    };
  }
  if (okCount === 0) {
    return {
      title: "Export failed",
      body: `All ${failed} of ${totalUnits} renders failed — nothing exported.`,
    };
  }
  return {
    title: "Partial export",
    body: `Exported ${okCount} of ${totalUnits} PNGs — bundle is named -partial-.`,
  };
}

/** Stopped-export copy, mirroring the in-app toasts. */
export function stoppedExportMessage(okCount: number): ExportDoneMessage {
  if (okCount > 0) {
    return {
      title: "Export stopped",
      body: `Saved partial bundle (${okCount} PNG${okCount === 1 ? "" : "s"}).`,
    };
  }
  return { title: "Export stopped", body: "No screenshots were exported." };
}
