"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { Toaster, toast } from "sonner";
import {
  DEVICE_LABEL,
  getExportSizes,
  hasTheme,
  themeById,
} from "@/lib/constants";
import { detectPlatform, newSlide, nid } from "@/lib/defaults";
import { isBuiltInElementId, isTextElementId, textElementKey } from "@/lib/elements";
import { preloadImages } from "@/lib/image-cache";
import { exportFolderForLocale, resolveScreenshot, writeLocalized, DEFAULT_LOCALE } from "@/lib/locale";
import { reportError, useErrorLog } from "@/lib/error-log";
import { ensureFontsLoaded, fontsReadyWithTimeout } from "@/lib/fonts";
import { useProject } from "@/lib/storage";
import { activeProvider, useAppSettings } from "@/lib/app-settings";
import {
  applyLocaleTranslations,
  translateSlidesForLocale,
  findSourceSkips,
  TranslateError,
} from "@/lib/translate";
import { useActiveWorkspace, workspaceName } from "@/lib/workspaces";
import {
  ackFlush,
  isShell,
  onMenuAction,
  reportWorkspace,
  revealLastExport,
  setDocumentState,
  toggleTheme,
  trackExportSaves,
} from "@/lib/native";
import type {
  BuiltInElementId,
  Device,
  ElementId,
  ElementTransform,
  ScreenBackground,
  SelectedElement,
  Slide,
} from "@/lib/types";
import { ExportProgressIndicator } from "./export-progress";
import { Button } from "@/components/ui/button";
import { Inspector } from "./inspector";
import { PreviewStage } from "./preview-stage";
import { Sidebar } from "./sidebar";
import { DeckCanvas, getCanvas } from "./slide-canvas";
import { Toolbar } from "./toolbar";
// Heavy, rarely-on-first-paint surfaces load on demand: dialogs mount only
// when opened, and zip/snapshot libraries import inside export functions.
const SettingsDialog = dynamic(() =>
  import("./settings-dialog").then((m) => m.SettingsDialog),
);
const TranslateDialog = dynamic(() =>
  import("./translate-dialog").then((m) => m.TranslateDialog),
);
const ErrorLogDialog = dynamic(() =>
  import("./error-log-dialog").then((m) => m.ErrorLogDialog),
);
const ExportDialog = dynamic(() =>
  import("./export-dialog").then((m) => m.ExportDialog),
);
import {
  type ExportConfig,
  type ExportTarget,
  buildExportZipPath,
  getExportTargetById,
} from "@/lib/export-options";
import {
  bundleExportDoneMessage,
  clearExportProgress,
  notifyExportDone,
  reportExportIndeterminate,
  reportExportProgress,
  stoppedExportMessage,
} from "@/lib/export-notify";

export function ScreenshotEditor() {
  const workspace = useActiveWorkspace();
  const { state, setState, hydrated, savedAt, saveError, saving, saveNow, reset, resetDevice, undo, redo } =
    useProject(workspace);
  const { unread: errorUnread } = useErrorLog();
  const [errorLogOpen, setErrorLogOpen] = React.useState(false);
  // Tracks save errors already surfaced by the manual-save handler so the
  // autosave effect below doesn't toast twice for the same failure.
  const lastManualSaveErrorRef = React.useRef<string | null>(null);
  const [activeSlideId, setActiveSlideId] = React.useState<string | null>(null);
  const [selectedElement, setSelectedElement] = React.useState<SelectedElement | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [translateOpen, setTranslateOpen] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [translatingLocale, setTranslatingLocale] = React.useState(false);
  const translateLocaleAbortRef = React.useRef<AbortController | null>(null);
  const { settings: appSettings } = useAppSettings();
  const [exportLocaleOverride, setExportLocaleOverride] = React.useState<string | null>(null);
  const [exportSlideIndex, setExportSlideIndex] = React.useState(0);
  const exportRef = React.useRef<HTMLDivElement | null>(null);
  const stopExportRef = React.useRef<boolean>(false);

  const currentSlides = React.useMemo(
    () => state.slidesByDevice[state.device] || [],
    [state.slidesByDevice, state.device],
  );
  // Translation source is always the default locale ("en"). All AI
  // translation reads English copy and writes to the target locale.
  const translationSourceLocale = DEFAULT_LOCALE;
  // Screens that carry localizable text: everything except static screens
  // without overlay texts (static label/headline slots don't render).
  const translatableCount = currentSlides.filter(
    (s) => s.layout !== "static" || (s.textElements || []).length > 0,
  ).length;
  // Live mirror of decks so translation results can be pruned to still-present
  // ids outside of state updaters.
  const decksRef = React.useRef(state.slidesByDevice);
  React.useEffect(() => {
    decksRef.current = state.slidesByDevice;
  });

  // Translate every screen of the current device deck into the currently
  // selected locale. Single setState so the run is one undo step.
  const handleTranslateLocale = React.useCallback(async () => {
    const target = state.locale;
    if (target === DEFAULT_LOCALE || translatableCount === 0) return;
    const provider = activeProvider(appSettings);
    if (!provider.apiKey) {
      toast.error("Add your API key first", {
        description: "Add your OpenRouter API key in Settings → Providers (then Test).",
        duration: 8000,
      });
      return;
    }
    const controller = new AbortController();
    translateLocaleAbortRef.current = controller;
    setTranslatingLocale(true);
    try {
      const results = await translateSlidesForLocale(
        { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: appSettings.model },
        currentSlides,
        DEFAULT_LOCALE,
        target,
        { overwrite: true, signal: controller.signal },
      );
      const count = Object.values(results).reduce(
        (n, r) =>
          n +
          (r.label !== undefined ? 1 : 0) +
          (r.headline !== undefined ? 1 : 0) +
          Object.keys(r.texts || {}).length,
        0,
      );
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: applyLocaleTranslations(
            prev.slidesByDevice[prev.device] || [],
            results,
            target,
            true,
          ),
        },
      }));
      toast.success(`Translated ${count} strings to ${target}`, {
        description: (() => {
          const skipped = findSourceSkips(currentSlides, DEFAULT_LOCALE).length;
          return skipped > 0
            ? `${skipped} field${skipped === 1 ? "" : "s"} skipped (no ${DEFAULT_LOCALE} source text)`
            : undefined;
        })(),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const message = e instanceof TranslateError ? e.message : String(e);
      reportError("translate", `Translate ${translatableCount} screens to ${target} failed`, message);
      toast.error("Translation failed", { description: message, duration: 8000 });
    } finally {
      setTranslatingLocale(false);
      if (translateLocaleAbortRef.current === controller) {
        translateLocaleAbortRef.current = null;
      }
    }
  }, [state.locale, translatableCount, appSettings, currentSlides, setState]);

  React.useEffect(() => {
    return () => translateLocaleAbortRef.current?.abort();
  }, []);

  // Load the project's caption typefaces (runtime Google Fonts) so canvas,
  // thumbs, and exports render the selected families.
  React.useEffect(() => {
    if (!hydrated) return;
    void ensureFontsLoaded([state.headlineFont, state.labelFont]);
  }, [hydrated, state.headlineFont, state.labelFont]);
  const activeSlide =
    currentSlides.find((s) => s.id === activeSlideId) || currentSlides[0] || null;
  const theme = themeById(state.themeId);

  React.useEffect(() => {
    if (selectedElement && selectedElement.slideId !== activeSlide?.id) {
      setSelectedElement(null);
    }
  }, [activeSlide?.id, selectedElement]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!activeSlide && currentSlides.length > 0) {
      setActiveSlideId(currentSlides[0].id);
    }
  }, [hydrated, currentSlides, activeSlide]);

  React.useEffect(() => {
    if (hydrated && state.themeId && !hasTheme(state.themeId)) {
      toast.warning("Using fallback theme", {
        description: `Theme "${state.themeId}" is not defined in src/lib/constants.ts.`,
        duration: 8000,
      });
    }
  }, [hydrated, state.themeId]);

  const assetPaths = React.useMemo(() => {
    const paths = new Set<string>();
    if (state.appIcon) {
      paths.add(
        state.appIcon.includes("{locale}")
          ? resolveScreenshot(state.appIcon, state.locale)
          : state.appIcon,
      );
    }
    for (const bg of backgroundImagePaths(state.background)) paths.add(bg);
    // Preload locale variants for the current device only. Preloading every
    // device's slides fetched URLs that may not exist (e.g. empty iPad asset
    // folders) and spammed the console with 404s for locales/devices the user
    // never selected.
    const deviceSlides: Slide[] = state.slidesByDevice[state.device] || [];
    for (const s of deviceSlides) {
      for (const raw of [s.screenshot, s.screenshotSecondary]) {
        if (!raw || raw.startsWith("data:")) continue;
        if (raw.includes("{locale}")) {
          for (const loc of state.locales) paths.add(resolveScreenshot(raw, loc));
        } else {
          paths.add(raw);
        }
      }
      for (const bg of backgroundImagePaths(s.background)) paths.add(bg);
    }
    return Array.from(paths).sort();
  }, [state.slidesByDevice, state.appIcon, state.background, state.locales, state.device, state.locale]);
  const assetSig = assetPaths.join("|");

  React.useEffect(() => {
    if (!hydrated) return;
    preloadImages(assetPaths)
      .catch(() => {})
      .finally(() => setReady(true));
    // assetPaths is derived from assetSig; depending on the string keeps the
    // effect from re-firing when slidesByDevice churns without path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, assetSig]);

  // Surface storage failures (quota exceeded etc.) so the user knows their work isn't safe.
  // Skips errors the manual-save handler already reported to avoid double toasts.
  React.useEffect(() => {
    if (saveError && lastManualSaveErrorRef.current !== saveError) {
      lastManualSaveErrorRef.current = saveError;
      reportError("storage", saveError);
      toast.error("Couldn't load or save project file", {
        description: saveError,
        duration: 8000,
      });
    }
  }, [saveError]);

  // Manual save: immediate persist with explicit feedback.
  const handleSaveNow = React.useCallback(async () => {
    const result = await saveNow();
    if (result.ok) {
      toast.success("Project saved");
    } else {
      lastManualSaveErrorRef.current = result.error;
      reportError("storage", result.error);
      toast.error("Couldn't save project file", {
        description: result.error,
        duration: 8000,
      });
    }
  }, [saveNow]);

  // Cmd/Ctrl+S saves even from inside text inputs. Inside the Electron
  // shell the native File → Save item covers this app-wide (including text
  // inputs), so the page handler stays as the web-only fallback — otherwise
  // every save would fire twice.
  React.useEffect(() => {
    function onSaveKey(e: KeyboardEvent) {
      if (isShell()) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveNow();
      }
    }
    window.addEventListener("keydown", onSaveKey);
    return () => window.removeEventListener("keydown", onSaveKey);
  }, [handleSaveNow]);

  // Native menu actions (N3): File and View items drive the same handlers as
  // the toolbar buttons. Undo/redo respect text focus — native text undo
  // inside inputs, canvas history everywhere else.
  React.useEffect(() => {
    function focusInEditable(): boolean {
      const t = document.activeElement as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    }
    return onMenuAction((action, payload) => {
      switch (action) {
        case "save":
          void handleSaveNow();
          break;
        case "export":
          if (!exporting) setExportDialogOpen(true);
          break;
        case "open-settings":
          setSettingsOpen(true);
          break;
        case "open-error-log":
          setErrorLogOpen(true);
          break;
        case "toggle-theme":
          toggleTheme();
          break;
        case "undo":
          if (focusInEditable()) document.execCommand("undo");
          else undo();
          break;
        case "redo":
          if (focusInEditable()) document.execCommand("redo");
          else redo();
          break;
        case "request-flush":
          // Quit-guard (N4): persist immediately, then let the window close.
          // No toasts — the window is going away.
          void (async () => {
            try {
              await saveNow();
            } finally {
              ackFlush();
            }
          })();
          break;
        case "open-workspace-picker":
          window.dispatchEvent(new CustomEvent("storeshot:pick-workspace-native"));
          break;
        case "open-workspace-path":
          if (typeof payload === "string" && payload) {
            window.dispatchEvent(
              new CustomEvent<string>("storeshot:open-workspace-path", { detail: payload }),
            );
          }
          break;
        case "reveal-workspace":
          window.dispatchEvent(new CustomEvent("storeshot:reveal-workspace"));
          break;
        default:
          break;
      }
    });
  }, [handleSaveNow, saveNow, undo, redo, exporting]);

  // Dirty-document reporting for the native close dot + quit guard (N4), and
  // workspace reporting for recents/Dock (N5). All shell-only no-ops on web.
  const pushDocumentState = React.useCallback(
    (dirty: boolean) => {
      const title = `${state.appName?.trim() || "Untitled"} — ${workspaceName(workspace)}`;
      document.title = `${dirty ? "• " : ""}${title} — StoreShot`;
      setDocumentState(dirty, `${title} — StoreShot`);
    },
    [state.appName, workspace],
  );
  React.useEffect(() => {
    if (!hydrated) return;
    pushDocumentState(true);
  }, [state, hydrated, pushDocumentState]);
  React.useEffect(() => {
    if (!hydrated || saving) return;
    pushDocumentState(false);
  }, [savedAt, saving, hydrated, pushDocumentState]);
  React.useEffect(() => {
    if (!hydrated) return;
    reportWorkspace(workspace);
  }, [workspace, hydrated]);
  React.useEffect(() => {
    trackExportSaves();
  }, []);

  // Global error capture: uncaught exceptions and unhandled rejections land
  // in the error log and surface as toasts.
  React.useEffect(() => {
    function onWindowError(e: ErrorEvent) {
      const message = e.message || "Unknown error";
      const where =
        e.filename != null && e.filename !== ""
          ? `${e.filename}${typeof e.lineno === "number" ? `:${e.lineno}` : ""}${typeof e.colno === "number" ? `:${e.colno}` : ""}`
          : undefined;
      reportError("app", message, where);
      toast.error("Something went wrong", {
        description: message,
        duration: 8000,
      });
    }
    function onUnhandledRejection(e: PromiseRejectionEvent) {
      const message =
        e.reason instanceof Error ? e.reason.message || String(e.reason) : String(e.reason);
      reportError("app", `Unhandled rejection: ${message}`);
      toast.error("Something went wrong", {
        description: message,
        duration: 8000,
      });
    }
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  // ---------- Mutations ----------

  const patchSlide = React.useCallback(
    (id: string, patch: Partial<Slide>) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        },
      }));
    },
    [setState],
  );

  const reorderSlides = React.useCallback(
    (next: Slide[]) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
      }));
    },
    [setState],
  );

  const deleteSlide = React.useCallback(
    (id: string) => {
      const dev = state.device;
      const slides = state.slidesByDevice[dev] || [];
      const idx = slides.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const snap = slides[idx];
      const fallback = slides[idx + 1] || slides[idx - 1] || null;
      // Anchor for restore: the id of the slide that followed the deleted
      // one. Resolved at click time so device switches and later edits can't
      // misplace the restore (stale index bug).
      const anchorId = slides[idx + 1]?.id ?? null;

      setState((prev) => {
        const cur = prev.slidesByDevice[dev] || [];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [dev]: cur.filter((s) => s.id !== id) },
        };
      });
      setActiveSlideId((cur) => (cur === id ? fallback?.id || null : cur));

      toast("Screen deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            setState((prev) => {
              const cur = prev.slidesByDevice[dev] || [];
              if (cur.some((s) => s.id === snap.id)) return prev;
              const anchorIdx = anchorId ? cur.findIndex((s) => s.id === anchorId) : -1;
              const at = anchorIdx === -1 ? cur.length : anchorIdx;
              const restored = [...cur.slice(0, at), snap, ...cur.slice(at)];
              return {
                ...prev,
                device: dev,
                slidesByDevice: { ...prev.slidesByDevice, [dev]: restored },
              };
            });
            setActiveSlideId(snap.id);
          },
        },
        duration: 6000,
      });
    },
    [setState, state.device, state.slidesByDevice],
  );

  const addSlide = React.useCallback(
    (slide: Slide) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: [...(prev.slidesByDevice[prev.device] || []), slide],
        },
      }));
      setActiveSlideId(slide.id);
    },
    [setState],
  );

  const patchLocalized = React.useCallback(
    (slide: Slide, key: "label" | "headline", value: string) => {
      patchSlide(slide.id, {
        [key]: writeLocalized(slide[key], state.locale, value),
      } as Partial<Slide>);
    },
    [patchSlide, state.locale],
  );

  // Stable wrappers for the preview stage so its memoized edit-handler
  // object (and the whole DeckCanvas subtree) survives unrelated renders.
  const handlePreviewLabel = React.useCallback(
    (slide: Slide, v: string) => patchLocalized(slide, "label", v),
    [patchLocalized],
  );
  const handlePreviewHeadline = React.useCallback(
    (slide: Slide, v: string) => patchLocalized(slide, "headline", v),
    [patchLocalized],
  );

  const patchElementTransform = React.useCallback(
    (slideId: string, elementId: ElementId, transform: ElementTransform) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) => {
            if (slide.id !== slideId) return slide;
            if (isTextElementId(elementId)) {
              const textId = textElementKey(elementId);
              return {
                ...slide,
                textElements: (slide.textElements || []).map((element) =>
                  element.id === textId ? { ...element, transform } : element,
                ),
              };
            }
            if (!isBuiltInElementId(elementId)) return slide;
            return {
              ...slide,
              transforms: {
                ...(slide.transforms || {}),
                [elementId]: transform,
              } as Partial<Record<BuiltInElementId, ElementTransform>>,
            };
          }),
        },
      }));
    },
    [setState],
  );

  const patchTextElementText = React.useCallback(
    (slideId: string, textId: string, value: string) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) =>
            slide.id === slideId
              ? {
                  ...slide,
                  textElements: (slide.textElements || []).map((element) =>
                    element.id === textId
                      ? { ...element, text: writeLocalized(element.text, prev.locale, value) }
                      : element,
                  ),
                }
              : slide,
          ),
        },
      }));
    },
    [setState],
  );

  const duplicateSlide = React.useCallback(
    (id: string) => {
      let newId: string | null = null;
      setState((prev) => {
        const slides = prev.slidesByDevice[prev.device] || [];
        const idx = slides.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const src = slides[idx];
        newId = nid();
        const copy: Slide = {
          ...src,
          id: newId,
          label: { ...src.label },
          headline: { ...src.headline },
          transforms: src.transforms
            ? Object.fromEntries(
                Object.entries(src.transforms).map(([key, value]) => [key, { ...value }]),
              )
            : undefined,
          textElements: src.textElements?.map((element) => ({
            ...element,
            id: nid(),
            text: { ...element.text },
            transform: { ...element.transform },
          })),
        };
        const next = [...slides.slice(0, idx + 1), copy, ...slides.slice(idx + 1)];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
        };
      });
      if (newId) setActiveSlideId(newId);
    },
    [setState],
  );

  // ---------- Keyboard shortcuts ----------

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable);
      if (exporting) return;

      if (e.key === "Escape") {
        setSelectedElement(null);
        if (target && "blur" in target && typeof target.blur === "function") target.blur();
        return;
      }

      // Let focused inputs and contenteditable text keep their native undo,
      // redo, selection, and deletion behavior.
      if (inEditable) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!currentSlides.length) return;
      const idx = activeSlide ? currentSlides.findIndex((s) => s.id === activeSlide.id) : -1;
      if (e.key === "ArrowDown" || (e.key === "j" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.min(currentSlides.length - 1, idx + 1)];
        if (next) setActiveSlideId(next.id);
      } else if (e.key === "ArrowUp" || (e.key === "k" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.max(0, idx - 1)];
        if (next) setActiveSlideId(next.id);
      } else if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey)) {
        if (activeSlide) {
          e.preventDefault();
          duplicateSlide(activeSlide.id);
        }
      } else if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) {
        if (activeSlide) {
          e.preventDefault();
          deleteSlide(activeSlide.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide, currentSlides, duplicateSlide, deleteSlide, exporting, undo, redo]);

  // ---------- Export ----------

  // Wait two animation frames so React's render → browser layout/paint of the
  // off-screen container settles before html-to-image snapshots it. One frame
  // is occasionally not enough on slower machines. The timeout fallback keeps
  // exports moving when the tab is hidden (rAF never fires off-screen, which
  // would otherwise stall the whole bundle with no error).
  const waitForPaint = () =>
    new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(fallback);
        resolve();
      };
      const fallback = setTimeout(finish, 500);
      requestAnimationFrame(() => requestAnimationFrame(finish));
    });

  const stopExport = React.useCallback(() => {
    stopExportRef.current = true;
    toast.info("Stopping export...");
  }, []);

  async function exportWithConfig(config: ExportConfig) {
    if (!currentSlides.length) {
      toast.error("No screens to export");
      return;
    }

    const targets = config.selectedTargetIds
      .map((id) => getExportTargetById(id))
      .filter((t): t is ExportTarget => Boolean(t));

    if (!targets.length) {
      toast.error("No target devices selected");
      return;
    }

    const locales = config.selectedLocales.filter(
      (l) => state.locales.includes(l) && exportFolderForLocale(l) !== null,
    );
    if (!locales.length) {
      toast.error("No locales selected");
      return;
    }

    const targetSlideIndices: number[] = [];
    currentSlides.forEach((slide, idx) => {
      if (config.selectedSlideIds.includes(slide.id)) {
        targetSlideIndices.push(idx);
      }
    });

    if (!targetSlideIndices.length) {
      toast.error("No screens selected to export");
      return;
    }

    const selectedSlides = targetSlideIndices.map((i) => currentSlides[i]);

    stopExportRef.current = false;
    // Preload only the selected slides × selected locales so unselected
    // assets (e.g. missing iPad files) are never fetched during export.
    const exportPaths: string[] = [];
    if (state.appIcon) {
      exportPaths.push(
        state.appIcon.includes("{locale}")
          ? resolveScreenshot(state.appIcon, state.locale)
          : state.appIcon,
      );
    }
    exportPaths.push(...backgroundImagePaths(state.background));
    for (const s of selectedSlides) {
      for (const raw of [s.screenshot, s.screenshotSecondary]) {
        if (!raw || raw.startsWith("data:")) continue;
        if (raw.includes("{locale}")) {
          for (const loc of locales) exportPaths.push(resolveScreenshot(raw, loc));
        } else {
          exportPaths.push(raw);
        }
      }
      exportPaths.push(...backgroundImagePaths(s.background ?? state.background));
    }
    await preloadImages(exportPaths, { retryFailed: true });
    await waitForPaint();
    const missingScreens = selectedSlides.filter(
      (s) => slideNeedsScreenshot(state.device, s) && !s.screenshot,
    );
    if (missingScreens.length > 0) {
      toast.warning("Export includes placeholder screenshots", {
        description: `${missingScreens.length} screen${missingScreens.length === 1 ? "" : "s"} will export with an empty device.`,
        duration: 6000,
      });
    }

    // Make sure custom fonts are loaded before snapshot so typography in PNG
    // matches what's on screen. Bounded so offline exports can't hang.
    await ensureFontsLoaded([state.headlineFont, state.labelFont]);
    await fontsReadyWithTimeout();

    const { cW, cH } = getCanvas(state.device);
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    // Every (locale × target × screen) combination must end up in the zip.
    // Units are tracked by zip path so a final verification can prove
    // completeness instead of trusting the happy path.
    type Unit = { locale: string; target: ExportTarget; slideIdx: number; zipPath: string };
    const units: Unit[] = [];
    // Number by position within the selection so deselected screens leave no
    // gaps (selecting deck screens 3+5 yields 01, 02 — not 03, 05).
    const posOf = new Map(targetSlideIndices.map((idx, pos) => [idx, pos + 1]));
    for (const locale of locales) {
      for (const target of targets) {
        for (const slideIdx of targetSlideIndices) {
          const slide = currentSlides[slideIdx];
          units.push({
            locale,
            target,
            slideIdx,
            zipPath: buildExportZipPath(
              target,
              // Upload folder follows the selected store's codes
              // (e.g. sl-SI on Apple, sl on Google Play), never the
              // internal code.
              exportFolderForLocale(locale, config.store) ?? locale,
              slideIdx,
              slide.layout,
              config.folderPreset,
              posOf.get(slideIdx) ?? slideIdx + 1,
            ),
          });
        }
      }
    }
    const totalUnits = units.length;
    const failures = new Map<string, string>(); // zipPath -> last error

    async function runUnit(u: Unit, attempts: number): Promise<void> {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (stopExportRef.current) return;
        setExportLocaleOverride(u.locale);
        setExportSlideIndex(u.slideIdx);
        await waitForPaint();
        const el = exportRef.current;
        if (!el) {
          failures.set(u.zipPath, `${u.locale} ${u.target.name} screen ${u.slideIdx + 1}: render target missing`);
          return;
        }
        try {
          const dataUrl = await captureSlide(el, cW, cH, u.target.w, u.target.h);
          const base64 = dataUrl.split(",")[1] || "";
          if (!base64) throw new Error("empty render output");
          zip.file(u.zipPath, base64, { base64: true });
          failures.delete(u.zipPath);
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          failures.set(
            u.zipPath,
            `${u.locale} ${u.target.name} screen ${u.slideIdx + 1} (attempt ${attempt}/${attempts}): ${msg}`,
          );
          console.error("Export failed", { slideId: currentSlides[u.slideIdx]?.id, locale: u.locale, target: u.target, attempt }, e);
        }
      }
    }

    function unitAssetPaths(u: Unit): string[] {
      const slide = currentSlides[u.slideIdx];
      if (!slide) return [];
      const paths: string[] = [];
      for (const raw of [slide.screenshot, slide.screenshotSecondary]) {
        if (!raw || raw.startsWith("data:")) continue;
        paths.push(raw.includes("{locale}") ? resolveScreenshot(raw, u.locale) : raw);
      }
      paths.push(...backgroundImagePaths(slide.background ?? state.background));
      return paths;
    }

    // Pass 1: render everything, 2 attempts per unit (html-to-image is flaky
    // on full-resolution canvases).
    let done = 0;
    for (const u of units) {
      if (stopExportRef.current) break;
      done += 1;
      setExporting(`${done}/${totalUnits}`);
      reportExportProgress(done, totalUnits);
      await runUnit(u, 2);
    }

    // Pass 2: refresh assets that may have flaked, then retry every unit
    // that is still missing — no locale ships partial.
    if (!stopExportRef.current && failures.size > 0) {
      const retryList = units.filter((u) => failures.has(u.zipPath));
      let ri = 0;
      for (const u of retryList) {
        if (stopExportRef.current) break;
        ri += 1;
        setExporting(`retry ${ri}/${retryList.length}`);
        reportExportIndeterminate();
        await preloadImages(unitAssetPaths(u), { retryFailed: true });
        await runUnit(u, 2);
      }
    }

    const errors = [...failures.values()];
    const failed = errors.length;
    const okCount = totalUnits - failed;

    const wasStopped = stopExportRef.current;
    setExportLocaleOverride(null);
    setExporting(null);
    clearExportProgress();

    if (wasStopped) {
      if (okCount > 0) {
        try {
          const blob = await zip.generateAsync({ type: "blob" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${slugify(state.appName)}-partial-${stamp()}.zip`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          toast.info(`Export stopped. Saved partial bundle (${okCount} PNGs).`);
        } catch {
          toast.info("Export stopped.");
        }
      } else {
        toast.info("Export stopped.");
      }
      notifyExportDone(stoppedExportMessage(okCount));
      return;
    }

    if (okCount > 0) {
      try {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // A bundle missing any unit is named -partial- so it can never be
        // mistaken for a complete export.
        a.download = failed === 0
          ? `${slugify(state.appName)}-screenshots-${config.folderPreset}-${stamp()}.zip`
          : `${slugify(state.appName)}-partial-${stamp()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) {
        toast.error("Couldn't bundle export");
        reportError("export", "Couldn't bundle export", e instanceof Error ? e.message : String(e));
        console.error(e);
        notifyExportDone({ title: "Export failed", body: "Couldn't bundle export." });
        return;
      }
    }

    // Final verification: every expected path must be in the zip.
    const zipPaths = new Set(Object.keys(zip.files));
    const missingPaths = units
      .map((u) => u.zipPath)
      .filter((p) => !zipPaths.has(p) && okCount > 0);
    const fullDetail = [...errors, ...missingPaths.map((p) => `${p}: missing from bundle`)];
    const summary = `${targets.length} target${targets.length === 1 ? "" : "s"} × ${locales.length} locale${locales.length === 1 ? "" : "s"} × ${targetSlideIndices.length} screen${targetSlideIndices.length === 1 ? "" : "s"}`;
    if (failed === 0 && missingPaths.length === 0) {
      toast.success(`Exported ${okCount} PNGs (${summary})`, {
        ...(isShell()
          ? { action: { label: "Reveal in Finder", onClick: () => revealLastExport() } }
          : {}),
      });
    } else if (okCount === 0) {
      reportError("export", `All ${failed} renders failed (${summary})`, fullDetail.slice(0, 40).join("\n"));
      toast.error(`All ${failed} renders failed — nothing exported`, {
        description: "Open the error log (bug icon, top right) for the full list.",
      });
    } else {
      reportError(
        "export",
        `Partial export: ${failed} of ${totalUnits} renders failed (${summary})`,
        fullDetail.slice(0, 40).join("\n"),
      );
      toast.error(`Partial export: ${failed} of ${totalUnits} failed`, {
        description: "Downloaded bundle is named -partial-. Open the error log (bug icon, top right) for the full missing list, then re-export.",
        duration: 10000,
      });
    }
    notifyExportDone(bundleExportDoneMessage(okCount, failed, totalUnits));
  }

  async function exportActiveSlide() {
    if (!activeSlide) {
      toast.error("No screen selected");
      return;
    }
    const idx = currentSlides.findIndex((s) => s.id === activeSlide.id);
    if (idx === -1) {
      toast.error("Screen not found");
      return;
    }

    const sizes = getExportSizes(state.device);
    if (!sizes.length) {
      toast.error("Nothing to export");
      return;
    }

    stopExportRef.current = false;
    setExporting("1/1");
    reportExportIndeterminate();
    setExportSlideIndex(idx);
    setExportLocaleOverride(state.locale);

    const singlePaths: string[] = [];
    if (state.appIcon) {
      singlePaths.push(
        state.appIcon.includes("{locale}")
          ? resolveScreenshot(state.appIcon, state.locale)
          : state.appIcon,
      );
    }
    singlePaths.push(...backgroundImagePaths(activeSlide.background ?? state.background));
    for (const raw of [activeSlide.screenshot, activeSlide.screenshotSecondary]) {
      if (!raw || raw.startsWith("data:")) continue;
      singlePaths.push(
        raw.includes("{locale}") ? resolveScreenshot(raw, state.locale) : raw,
      );
    }
    await preloadImages(singlePaths, { retryFailed: true });
    await waitForPaint();

    await ensureFontsLoaded([state.headlineFont, state.labelFont]);
    await fontsReadyWithTimeout();

    const { cW, cH } = getCanvas(state.device);
    const platform = detectPlatform(state.device);
    const el = exportRef.current;
    if (!el) {
      toast.error("Render target missing");
      setExporting(null);
      clearExportProgress();
      setExportLocaleOverride(null);
      return;
    }

    try {
      if (sizes.length === 1) {
        const size = sizes[0];
        const dataUrl = await captureWithSingleRetry(el, cW, cH, size.w, size.h);
        const a = document.createElement("a");
        a.href = dataUrl;
        const num = String(idx + 1).padStart(2, "0");
        a.download = `${slugify(state.appName)}-${platform}-${state.device}-${num}-${activeSlide.layout}-${state.locale}-${size.w}x${size.h}.png`;
        a.click();
        toast.success(`Exported screen ${idx + 1} (${size.w}×${size.h})`, {
          ...(isShell()
            ? { action: { label: "Reveal in Finder", onClick: () => revealLastExport() } }
            : {}),
        });
        notifyExportDone({
          title: "Export complete",
          body: `Exported screen ${idx + 1} (${size.w}×${size.h}).`,
        });
      } else {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const size of sizes) {
          const dataUrl = await captureWithSingleRetry(el, cW, cH, size.w, size.h);
          const base64 = dataUrl.split(",")[1] || "";
          const num = String(idx + 1).padStart(2, "0");
          const filename = `${num}-${activeSlide.layout}-${size.w}x${size.h}.png`;
          zip.file(filename, base64, { base64: true });
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const num = String(idx + 1).padStart(2, "0");
        a.download = `${slugify(state.appName)}-${platform}-${state.device}-${num}-${state.locale}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success(`Exported screen ${idx + 1} (${sizes.length} sizes)`, {
          ...(isShell()
            ? { action: { label: "Reveal in Finder", onClick: () => revealLastExport() } }
            : {}),
        });
        notifyExportDone({
          title: "Export complete",
          body: `Exported screen ${idx + 1} (${sizes.length} sizes).`,
        });
      }
    } catch (err) {
      console.error("Single screen export failed", err);
      const message = err instanceof Error ? err.message : String(err);
      reportError("export", `Single screen export failed (screen ${idx + 1})`, message);
      toast.error("Export failed: " + message);
      notifyExportDone({ title: "Export failed", body: message });
    } finally {
      setExporting(null);
      clearExportProgress();
      setExportLocaleOverride(null);
    }
  }

  async function captureWithSingleRetry(
    el: HTMLElement,
    sourceW: number,
    sourceH: number,
    exportW: number,
    exportH: number,
  ) {
    try {
      return await captureSlide(el, sourceW, sourceH, exportW, exportH);
    } catch (e) {
      // One retry after letting the render settle — html-to-image flakes on
      // full-resolution canvases.
      await waitForPaint();
      return await captureSlide(el, sourceW, sourceH, exportW, exportH);
    }
  }

  async function captureSlide(
    el: HTMLElement,
    sourceW: number,
    sourceH: number,
    exportW: number,
    exportH: number,
  ) {
    // html-to-image needs the node at (0,0). Let the library scale the source
    // canvas into the requested output dimensions; CSS transforms leave
    // transparent gutters when export aspect ratios differ by a few pixels.
    const prev = {
      left: el.style.left,
      top: el.style.top,
      position: el.style.position,
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
      zIndex: el.style.zIndex,
    };
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.position = "absolute";
    el.style.transform = "none";
    el.style.transformOrigin = "top left";
    el.style.zIndex = "-1";
    try {
      // Imported lazily so first paint never pays for the snapshot library.
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        width: sourceW,
        height: sourceH,
        canvasWidth: exportW,
        canvasHeight: exportH,
        pixelRatio: 1,
        cacheBust: false,
        backgroundColor: "#ffffff",
      });
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        throw new Error("snapshot produced no image output");
      }
      return dataUrl;
    } finally {
      el.style.left = prev.left || "-99999px";
      el.style.top = prev.top || "0px";
      el.style.position = prev.position || "absolute";
      el.style.transform = prev.transform;
      el.style.transformOrigin = prev.transformOrigin;
      el.style.zIndex = prev.zIndex;
    }
  }

  // ---------- Render ----------

  if (!hydrated || !ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">Loading editor…</p>
        </div>
      </div>
    );
  }

  const { cW, cH } = getCanvas(state.device);
  const busy = !!exporting;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Toaster position="bottom-center" richColors closeButton />
      <Toolbar
        appName={state.appName}
        setAppName={(v) => setState((p) => ({ ...p, appName: v }))}
        connectedCanvas={state.connectedCanvas}
        setConnectedCanvas={(v) => setState((p) => ({ ...p, connectedCanvas: v }))}
        locale={state.locale}
        setLocale={(v) => setState((p) => ({ ...p, locale: v }))}
        locales={state.locales}
        device={state.device}
        setDevice={(v) => setState((p) => ({ ...p, device: v }))}
        onExport={() => setExportDialogOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTranslate={() => setTranslateOpen(true)}
        onStopExport={stopExport}
        translatableCount={translatableCount}
        translatingLocale={translatingLocale}
        canTranslateLocale={activeProvider(appSettings).apiKey.length > 0}
        onTranslateLocale={() => void handleTranslateLocale()}
        onResetAll={() => {
          reset();
          setActiveSlideId(null);
          toast.success(`Reset ${DEVICE_LABEL[state.device] ?? "iPhone"} screens to defaults`);
        }}
        onResetDevice={() => {
          resetDevice(state.device);
          setActiveSlideId(null);
          toast.success(`Reset ${DEVICE_LABEL[state.device] ?? "iPhone"} screens to defaults`);
        }}
        exporting={exporting}
        savedAt={savedAt}
        saveError={saveError}
        saving={saving}
        onSave={() => void handleSaveNow()}
        errorCount={errorUnread}
        onOpenErrorLog={() => setErrorLogOpen(true)}
        busy={busy}
      />

      <ErrorLogDialog open={errorLogOpen} onOpenChange={setErrorLogOpen} />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        locales={state.locales}
        currentLocale={state.locale}
        headlineFont={state.headlineFont}
        labelFont={state.labelFont}
        disabled={busy}
        onAddLocale={(locale) =>
          setState((prev) =>
            prev.locales.includes(locale)
              ? prev
              : { ...prev, locales: [...prev.locales, locale] },
          )
        }
        onRemoveLocale={(locale) =>
          setState((prev) => {
            if (!prev.locales.includes(locale) || prev.locales.length <= 1) return prev;
            const locales = prev.locales.filter((l) => l !== locale);
            return {
              ...prev,
              locales,
              locale: prev.locale === locale ? locales[0] : prev.locale,
            };
          })
        }
        onHeadlineFontChange={(family) => setState((p) => ({ ...p, headlineFont: family }))}
        onLabelFontChange={(family) => setState((p) => ({ ...p, labelFont: family }))}
      />

      <TranslateDialog
        open={translateOpen}
        onOpenChange={setTranslateOpen}
        locales={state.locales}
        slides={currentSlides}
        device={state.device}
        sourceLocale={translationSourceLocale}
        disabled={busy}
        onApplyTranslations={(targetLocale, results, overwrite, originDevice) => {
          // Prune to ids still present in the origin deck (screens deleted
          // mid-run are reported, never misapplied to another deck).
          const liveIds = new Set((decksRef.current[originDevice] || []).map((s) => s.id));
          const pruned = Object.fromEntries(
            Object.entries(results).filter(([id]) => liveIds.has(id)),
          );
          const dropped = Object.keys(results).length - Object.keys(pruned).length;
          setState((prev) => ({
            ...prev,
            slidesByDevice: {
              ...prev.slidesByDevice,
              [originDevice]: applyLocaleTranslations(
                prev.slidesByDevice[originDevice] || [],
                pruned,
                targetLocale,
                overwrite,
              ),
            },
          }));
          if (dropped > 0) {
            toast.warning(
              `${dropped} screen${dropped === 1 ? "" : "s"} changed during translation — skipped`,
            );
          }
        }}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        slides={currentSlides}
        locales={state.locales}
        currentLocale={state.locale}
        onStartExport={exportWithConfig}
        exporting={exporting}
      />

      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        {!workspace ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-lg font-semibold">Choose a workspace to get started</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick the project folder you want to work in — its screens, uploads, and
              project file live in a screenshots/ folder inside it.
            </p>
            <Button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-workspace-dialog"))
              }
            >
              Open folder…
            </Button>
          </div>
        ) : (
        <>
        <aside className="md:w-72 w-full shrink-0 border-r bg-card md:max-h-none max-h-64 overflow-hidden">
          <Sidebar
            slides={currentSlides}
            activeId={activeSlide?.id || null}
            device={state.device}
            theme={theme}
            locale={state.locale}
            connectedCanvas={state.connectedCanvas}
            headlineFont={state.headlineFont}
            labelFont={state.labelFont}
            background={state.background}
            disabled={busy}
            onReorder={reorderSlides}
            onSelect={setActiveSlideId}
            onDelete={deleteSlide}
            onDuplicate={duplicateSlide}
            onAdd={addSlide}
          />
        </aside>

        <main className="flex min-h-[280px] flex-1 items-stretch overflow-hidden md:min-h-0">
          {activeSlide && currentSlides.length > 0 ? (
            <PreviewStage
              slides={currentSlides}
              activeSlideId={activeSlide.id}
              device={state.device}
                theme={theme}
              locale={state.locale}
              connectedCanvas={state.connectedCanvas}
              selectedElement={selectedElement}
              headlineFont={state.headlineFont}
              labelFont={state.labelFont}
              background={state.background}
              onActiveSlideChange={setActiveSlideId}
              onLabelChange={handlePreviewLabel}
              onHeadlineChange={handlePreviewHeadline}
              onTextElementTextChange={patchTextElementText}
              onElementChange={patchElementTransform}
              onSelectElement={setSelectedElement}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted-foreground">
              <p className="text-base font-semibold text-foreground">
                {workspace ? "This workspace is empty" : "No screen selected"}
              </p>
              <p className="max-w-sm text-xs">
                {workspace
                  ? "Nothing has been added here yet — your screens, uploads, and project file live in this workspace's screenshots/ folder. Add your first screen to get started."
                  : "Add a screen on the left to get started."}
              </p>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => addSlide(newSlide())}
              >
                Add your first screen
              </Button>
            </div>
          )}
        </main>

        <aside className="md:w-80 w-full shrink-0 border-l bg-card md:max-h-none max-h-96 overflow-hidden">
          {activeSlide ? (
            <Inspector
              slide={activeSlide}
              device={state.device}
                locale={state.locale}
              locales={state.locales}
              selectedElementId={
                selectedElement?.slideId === activeSlide.id ? selectedElement.elementId : null
              }
              disabled={busy}
              onExportSlide={exportActiveSlide}
              onChange={(patch) => patchSlide(activeSlide.id, patch)}
              onSelectElement={(elementId) =>
                setSelectedElement(
                  elementId ? { slideId: activeSlide.id, elementId } : null,
                )
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Nothing to inspect</p>
              <p className="text-xs">Screen settings will appear here once you add or select one.</p>
            </div>
          )}
        </aside>
        </>
        )}
      </div>

      {/* Off-screen export container — full-resolution canvases for html-to-image. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {currentSlides.length > 0 && (
          <div
            ref={exportRef}
            style={{
              width: cW,
              height: cH,
              overflow: "hidden",
              position: "absolute",
              left: -99999,
              top: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -exportSlideIndex * cW,
                top: 0,
                width: cW * currentSlides.length,
                height: cH,
              }}
            >
              <DeckCanvas
                slides={currentSlides}
                device={state.device}
                    theme={theme}
                locale={exportLocaleOverride ?? state.locale}
                connectedCanvas={state.connectedCanvas}
                headlineFont={state.headlineFont}
                labelFont={state.labelFont}
                background={state.background}
                hideEmpty
              />
            </div>
          </div>
        )}
      </div>

      {exporting && (
        <ExportProgressIndicator progress={exporting} />
      )}
    </div>
  );
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "screenshots"
  );
}

function slideNeedsScreenshot(_device: Device, slide: Slide) {
  return slide.layout !== "no-device";
}

// Workspace file paths used by image backgrounds (project default or
// per-screen override). Data URLs and empty sources need no preload.
function backgroundImagePaths(bg: ScreenBackground | undefined): string[] {
  if (bg?.kind === "image" && bg.src && !bg.src.startsWith("data:")) return [bg.src];
  return [];
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
