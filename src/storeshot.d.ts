// Typings for the Electron preload bridge (window.storeshot).
// Absent in plain web builds — always access defensively.

interface StoreshotBridge {
  platform: NodeJS.Platform;
  versions: { app: string };
  /** Open the native workspace folder picker. Resolves to an absolute path or null. */
  pickWorkspace: () => Promise<string | null>;
}

interface Window {
  storeshot?: StoreshotBridge;
}
