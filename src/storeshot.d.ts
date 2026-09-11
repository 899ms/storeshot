// Typings for the Electron preload bridge (window.storeshot).
// Absent in plain web builds — always access defensively.

interface StoreshotBridge {
  platform: NodeJS.Platform;
  versions: { app: string };
  /** Open the native workspace folder picker. Resolves to an absolute path or null. */
  pickWorkspace: () => Promise<string | null>;
  /** Dock progress for exports: 0..1 determinate, >1 indeterminate. */
  reportExportProgress: (fraction: number) => void;
  /** Clear the Dock progress bar. */
  clearExportProgress: () => void;
  /** Show a native completion notification. */
  notifyExportDone: (title: string, body: string) => void;
  /** Subscribe to native menu actions. Returns an unsubscribe function. */
  onMenuAction: (callback: (action: string, payload?: unknown) => void) => () => void;
  /** Report dirty-document state for the close dot + quit guard. */
  setDocumentState: (state: { dirty: boolean; title: string }) => void;
  /** Acknowledge a quit-guard save flush so the window may close. */
  ackFlush: () => void;
  /** Report the active workspace so recents/Dock stay in sync. */
  reportWorkspace: (dir: string | null) => void;
  /** Reveal a file or folder in Finder. Resolves false for unusable input. */
  revealPath: (target: string) => Promise<boolean>;
  /** Fired with the absolute path when a native export download completes. */
  onExportSaved: (callback: (path: string) => void) => () => void;
}

interface Window {
  storeshot?: StoreshotBridge;
}
