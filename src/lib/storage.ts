"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_SCHEMA_VERSION, STORAGE_KEY } from "./constants";
import { DEFAULT_PROJECT, makeEmptyProject } from "./defaults";
import { MAX_SIZE_FACTOR as MAX_TEXT_SIZE_FACTOR, MIN_SIZE_FACTOR as MIN_TEXT_SIZE_FACTOR } from "./caption-style";
import { workspaceName } from "./workspaces";
import { coerceLocalized } from "./locale";
import { clearImageCache } from "./image-cache";
import type { BackgroundStyle, CanvasSize, Device, ElementTransform, FrameFinish, GlobalTextStyle, ProjectState, ScreenBackground, Slide, TextElement } from "./types";

const HISTORY_LIMIT = 50;
// Coalesce rapid edits (typing, slider drags) into a single undo step.
const COALESCE_MS = 500;
// Debounce file/localStorage writes — frequent enough to feel instant, infrequent enough not to thrash disk.
const SAVE_DEBOUNCE_MS = 600;

function cleanHex(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v) ? v : undefined;
}

function cleanNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

// Normalize a persisted background value. Unknown shapes, empty image
// sources, and bad colors fall back to the theme background so old and
// hand-edited project files always render.
function cleanBackground(value: unknown): ScreenBackground | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Partial<ScreenBackground> & { colors?: unknown; src?: unknown };
  // Optional style tweaks shared by every kind; invalid entries are dropped.
  const style: BackgroundStyle = {};
  const opacity = cleanNumber(raw.opacity, 0, 1);
  if (opacity !== undefined) style.opacity = opacity;
  const blur = cleanNumber(raw.blur, 0, 40);
  if (blur !== undefined) style.blur = blur;
  const angle = cleanNumber(raw.angle, 0, 360);
  if (angle !== undefined) style.angle = angle;
  if (raw.kind === "mesh") {
    const colors = Array.isArray(raw.colors)
      ? raw.colors.map(cleanHex).filter((c): c is string => !!c)
      : [];
    if (colors.length < 2) return undefined;
    return { kind: "mesh", colors: colors.slice(0, 4), ...style };
  }
  if (raw.kind === "image") {
    if (typeof raw.src !== "string" || !raw.src.trim()) return undefined;
    return { kind: "image", src: raw.src, ...style };
  }
  if (raw.kind === "theme") return { kind: "theme", ...style };
  return undefined;
}

function cleanTransform(value: unknown): ElementTransform | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ElementTransform>;
  const required = [raw.x, raw.y, raw.width, raw.height];
  if (!required.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  return {
    x: raw.x!,
    y: raw.y!,
    width: Math.max(1, raw.width!),
    height: Math.max(1, raw.height!),
    ...(typeof raw.rotation === "number" && Number.isFinite(raw.rotation)
      ? { rotation: raw.rotation }
      : {}),
    ...(typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex)
      ? { zIndex: raw.zIndex }
      : {}),
  };
}

function cleanTextElement(value: unknown): TextElement | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<TextElement>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return undefined;
  const transform = cleanTransform(raw.transform);
  if (!transform) return undefined;
  return {
    id: raw.id,
    text: coerceLocalized(raw.text as unknown),
    transform,
    ...(typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
      ? { fontSize: raw.fontSize }
      : {}),
    ...(typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)
      ? { fontWeight: raw.fontWeight }
      : {}),
    ...(typeof raw.color === "string" ? { color: raw.color } : {}),
    ...(raw.align === "left" || raw.align === "center" || raw.align === "right"
      ? { align: raw.align }
      : {}),
  };
}

// Sanitize per-device canvas size overrides. Out-of-range or partial values
// fall back to built-in defaults (effectiveCanvas enforces the same bounds).
function cleanCanvasSizes(value: unknown): Partial<Record<Device, CanvasSize>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cleaned: Partial<Record<Device, CanvasSize>> = {};
  for (const device of ["phone", "tablet", "desktop"] as const) {
    const entry = raw[device];
    if (!entry || typeof entry !== "object") continue;
    const { w, h } = entry as { w?: unknown; h?: unknown };
    const cw = cleanNumber(w, 200, 5000);
    const ch = cleanNumber(h, 200, 5000);
    if (cw !== undefined && ch !== undefined) {
      cleaned[device] = { w: Math.round(cw), h: Math.round(ch) };
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

const FRAME_FINISHES: FrameFinish[] = ["titanium", "black", "white", "none"];

// Sanitize mockup chassis finishes for Phone/Tablet.
function cleanFrames(value: unknown): Partial<Record<"phone" | "tablet", FrameFinish>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cleaned: Partial<Record<"phone" | "tablet", FrameFinish>> = {};
  for (const device of ["phone", "tablet"] as const) {
    const finish = raw[device];
    if (typeof finish === "string" && (FRAME_FINISHES as string[]).includes(finish)) {
      cleaned[device] = finish as FrameFinish;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// Sanitize project-wide Headline/Label defaults. Partial garbage falls back
// field-by-field; fully empty results stay undefined (builtin behavior).
function cleanGlobalTextStyle(value: unknown): GlobalTextStyle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const cleaned: GlobalTextStyle = {};
  if (typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)) {
    cleaned.fontWeight = Math.min(900, Math.max(100, Math.round(raw.fontWeight / 100) * 100));
  }
  if (typeof raw.sizeFactor === "number" && Number.isFinite(raw.sizeFactor)) {
    cleaned.sizeFactor = Math.min(MAX_TEXT_SIZE_FACTOR, Math.max(MIN_TEXT_SIZE_FACTOR, raw.sizeFactor));
  }
  if (typeof raw.color === "string") {
    const hex = cleanHex(raw.color);
    if (hex) cleaned.color = hex;
  }
  return cleaned.fontWeight !== undefined || cleaned.sizeFactor !== undefined || cleaned.color !== undefined
    ? cleaned
    : undefined;
}

// Migrate older projects into the current schema while keeping legacy decks
// visually stable until they explicitly opt into connected canvas.
function migrateSlide(slide: Slide): Slide {
  const transforms = slide.transforms
    ? Object.fromEntries(
        Object.entries(slide.transforms)
          .map(([id, transform]) => [id, cleanTransform(transform)])
          .filter((entry): entry is [string, ElementTransform] => !!entry[1]),
      )
    : undefined;
  const textElements = Array.isArray(slide.textElements)
    ? slide.textElements.map(cleanTextElement).filter((t): t is TextElement => !!t)
    : undefined;

  return {
    ...slide,
    label: coerceLocalized(slide.label as unknown),
    headline: coerceLocalized(slide.headline as unknown),
    ...(transforms && Object.keys(transforms).length > 0 ? { transforms } : { transforms: undefined }),
    ...(textElements && textElements.length > 0 ? { textElements } : { textElements: undefined }),
    background: cleanBackground(slide.background),
  };
}

function mergeWithDefaults(parsed: Partial<ProjectState>): ProjectState {
  const connectedCanvas =
    typeof parsed.connectedCanvas === "boolean"
      ? parsed.connectedCanvas
      : false;
  const themeId =
    typeof parsed.themeId === "string" && parsed.themeId.trim()
      ? parsed.themeId
      : DEFAULT_PROJECT.themeId;
  // Supported decks only — drop legacy decks for retired devices
  // (android, android-7, …) instead of carrying them forward. Legacy
  // "iphone"/"ipad" deck keys migrate to "phone"/"tablet".
  const parsedDecks = parsed.slidesByDevice as Record<string, unknown> | undefined;
  const slidesByDevice: Record<string, Slide[]> = {};
  const deckSources: Record<string, string[]> = {
    phone: ["phone", "iphone"],
    tablet: ["tablet", "ipad"],
    desktop: ["desktop"],
  };
  for (const device of ["phone", "tablet", "desktop"] as const) {
    for (const key of deckSources[device]) {
      const slides = parsedDecks?.[key];
      if (Array.isArray(slides)) {
        slidesByDevice[device] = (slides as Slide[]).map((slide) => migrateSlide(slide));
        break;
      }
    }
  }
  const rawDevice = parsed.device as string | undefined;
  const device: Device =
    rawDevice === "tablet" || rawDevice === "ipad"
      ? "tablet"
      : rawDevice === "desktop"
        ? "desktop"
        : "phone";
  const merged: ProjectState = {
    ...DEFAULT_PROJECT,
    ...parsed,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    themeId,
    connectedCanvas,
    background: cleanBackground(parsed.background) ?? { ...DEFAULT_PROJECT.background },
    device,
    canvasSizes: cleanCanvasSizes(parsed.canvasSizes),
    frames: cleanFrames(parsed.frames),
    slidesByDevice: {
      ...DEFAULT_PROJECT.slidesByDevice,
      ...slidesByDevice,
    } as ProjectState["slidesByDevice"],
  };
  // Drop legacy keys that no longer exist on ProjectState (retired device
  // decks, single-value orientation) so stale data can't re-enter via file
  // cache or be rewritten on save.
  delete (merged as unknown as Record<string, unknown>).orientation;
  // Drop legacy per-device extras (e.g. crossScreenMockupsByDevice for
  // retired devices) so stale data can't re-enter via file cache.
  const extra = merged as unknown as Record<string, unknown>;
  if (extra.crossScreenMockupsByDevice && typeof extra.crossScreenMockupsByDevice === "object") {
    const cs = extra.crossScreenMockupsByDevice as Record<string, unknown>;
    const pick = (keys: string[]) => {
      for (const key of keys) {
        if (Array.isArray(cs[key])) return cs[key];
      }
      return [];
    };
    extra.crossScreenMockupsByDevice = {
      phone: pick(["phone", "iphone"]),
      tablet: pick(["tablet", "ipad"]),
      desktop: pick(["desktop"]),
    };
  }
  // Clamp the active locale into the project's locale list so a stale
  // `locale` (e.g. from a project that dropped languages) doesn't show blank.
  if (!merged.locales || merged.locales.length === 0) {
    merged.locales = [...DEFAULT_PROJECT.locales];
  }
  if (!merged.locales.includes(merged.locale)) {
    merged.locale = merged.locales[0];
  }
  // Backfill caption typefaces for projects saved before fonts existed.
  if (typeof merged.headlineFont !== "string" || !merged.headlineFont.trim()) {
    merged.headlineFont = DEFAULT_PROJECT.headlineFont;
  }
  if (typeof merged.labelFont !== "string" || !merged.labelFont.trim()) {
    merged.labelFont = DEFAULT_PROJECT.labelFont;
  }
  // Sanitize project-wide text defaults (Settings → Text). Garbage falls
  // back to undefined = builtin behavior, so legacy projects render unchanged.
  merged.headlineText = cleanGlobalTextStyle(parsed.headlineText);
  merged.labelText = cleanGlobalTextStyle(parsed.labelText);
  return merged;
}

function cacheKey(workspace: string | null): string {
  return workspace ? `${STORAGE_KEY}::${workspace}` : STORAGE_KEY;
}

function fileUrl(workspace: string | null): string {
  return workspace ? `/api/project?ws=${encodeURIComponent(workspace)}` : "/api/project";
}

function loadFromLocalStorage(workspace: string | null): ProjectState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(workspace));
    if (!raw) return null;
    return mergeWithDefaults(JSON.parse(raw) as Partial<ProjectState>);
  } catch {
    return null;
  }
}

async function loadFromFile(
  workspace: string | null,
): Promise<{ ok: true; state: ProjectState | null } | { ok: false; error: string }> {
  if (typeof window === "undefined") return { ok: false, error: "Window is not available" };
  try {
    const resp = await fetch(fileUrl(workspace), { cache: "no-store" });
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const body = (await resp.json()) as { error?: string };
        if (body?.error) detail += `: ${body.error}`;
      } catch {
        // non-JSON error body — keep status only
      }
      return { ok: false, error: `Project file could not be loaded (${detail})` };
    }
    const json = (await resp.json()) as { ok: boolean; state: Partial<ProjectState> | null };
    if (!json.ok) return { ok: false, error: "Project response was not ok" };
    if (!json.state) return { ok: true, state: null };
    return { ok: true, state: mergeWithDefaults(json.state) };
  } catch {
    return { ok: false, error: "Project file could not be loaded" };
  }
}

function saveToLocalStorage(
  workspace: string | null,
  state: ProjectState,
): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: true };
  try {
    // Inline data: URIs (failed-upload fallback, hand-edited files) would
    // blow the ~5MB quota and break every save. The cache is only an
    // instant-paint layer — the file holds the truth — so strip them here.
    window.localStorage.setItem(cacheKey(workspace), JSON.stringify(stripInlineImages(state)));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

// Copy of state with inline data: image URIs blanked (cache payload only).
function stripInlineImages(state: ProjectState): ProjectState {
  const isInline = (v: string | undefined) => typeof v === "string" && v.startsWith("data:");
  return {
    ...state,
    appIcon: isInline(state.appIcon) ? undefined : state.appIcon,
    background:
      state.background?.kind === "image" && isInline(state.background.src)
        ? { kind: "theme" }
        : state.background,
    slidesByDevice: Object.fromEntries(
      Object.entries(state.slidesByDevice).map(([dev, slides]) => [
        dev,
        slides.map((s) => ({
          ...s,
          screenshot: isInline(s.screenshot) ? "" : s.screenshot,
          screenshotSecondary: isInline(s.screenshotSecondary)
            ? undefined
            : s.screenshotSecondary,
          background:
            s.background?.kind === "image" && isInline(s.background.src)
              ? undefined
              : s.background,
        })),
      ]),
    ) as ProjectState["slidesByDevice"],
  };
}

async function saveToFile(
  workspace: string | null,
  state: ProjectState,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof window === "undefined") return { ok: true };
  try {
    const resp = await fetch(fileUrl(workspace), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    const json = (await resp.json()) as { ok: boolean; error?: string };
    if (!json.ok) return { ok: false, error: json.error || "Unknown error" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type Updater = ProjectState | ((prev: ProjectState) => ProjectState);

function applyUpdater(updater: Updater, prev: ProjectState): ProjectState {
  return typeof updater === "function" ? updater(prev) : updater;
}

// Backfill for projects that were never named (the rename control is
// hidden): label them with the workspace folder name. Named projects pass
// through untouched.
function withDirectoryName(state: ProjectState, workspace: string): ProjectState {
  if (state.appName.trim()) return state;
  return { ...state, appName: workspaceName(workspace) };
}

export function useProject(workspace: string | null) {
  const [state, _setState] = useState<ProjectState>(DEFAULT_PROJECT);
  const [hydrated, setHydrated] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest committed state for imperative saves (manual Save / Cmd+S).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  // Whether the file endpoint is usable for the current workspace. Mirrored
  // in a ref so unmount/switch cleanups can flush safely.
  const fileReadyRef = useRef(false);
  useEffect(() => {
    fileReadyRef.current = fileReady;
  }, [fileReady]);

  // History stacks live in refs — they don't drive any rendered UI, so
  // mutating them never needs to re-render.
  const pastRef = useRef<ProjectState[]>([]);
  const futureRef = useRef<ProjectState[]>([]);
  const lastPushAt = useRef(0);

  // Hydrate: prefer file (workspace) → localStorage (cache) → fresh blank.
  // localStorage is consulted first for instant paint, then file overwrites if present.
  // Re-runs on workspace switch; history is reset per workspace.
  // With no workspace selected the hook stays inert: blank state, never saved.
  useEffect(() => {
    let cancelled = false;
    // Image cache entries are workspace-scoped — drop the old workspace's
    // base64 payloads instead of accumulating them forever.
    clearImageCache();
    setHydrated(false);
    setFileReady(false);
    setSaveError(null);
    if (!workspace) {
      _setState(makeEmptyProject());
      pastRef.current = [];
      futureRef.current = [];
      lastPushAt.current = 0;
      setHydrated(true);
      return;
    }
    const cached = loadFromLocalStorage(workspace);
    // A workspace we've never seen starts blank — never show another
    // workspace's screens there. Unnamed projects take the folder name so
    // imports are labeled without a rename step.
    const fresh = withDirectoryName(makeEmptyProject(), workspace);
    _setState(cached ? withDirectoryName(cached, workspace) : fresh);

    void (async () => {
      const fromFile = await loadFromFile(workspace);
      if (cancelled) return;
      if (fromFile.ok) {
        if (fromFile.state) {
          _setState(withDirectoryName(fromFile.state, workspace));
        } else if (!cached) {
          _setState(fresh);
        }
        setFileReady(true);
      } else {
        setFileReady(false);
        setSaveError(fromFile.error);
      }
      pastRef.current = [];
      futureRef.current = [];
      lastPushAt.current = 0;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
      // Flush any pending debounced save for the workspace we're leaving:
      // otherwise edits younger than SAVE_DEBOUNCE_MS are silently dropped.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (workspace && fileReadyRef.current) {
        const snap = stateRef.current;
        saveToLocalStorage(workspace, snap);
        void saveToFile(workspace, snap).catch(() => {});
      }
    };
  }, [workspace]);

  // Debounced autosave to BOTH localStorage (fast, offline) and file (workspace).
  useEffect(() => {
    if (!hydrated || !fileReady) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const localResult = saveToLocalStorage(workspace, state);
      void saveToFile(workspace, state).then((fileResult) => {
        if (fileResult.ok && localResult.ok) {
          setSavedAt(Date.now());
          setSaveError(null);
        } else if (!fileResult.ok && !localResult.ok) {
          setSaveError(fileResult.error);
        } else if (!fileResult.ok) {
          // Local cache succeeded but file save failed — work isn't git-portable yet.
          setSavedAt(Date.now());
          setSaveError(`File save failed: ${fileResult.error}`);
        } else {
          setSavedAt(Date.now());
          setSaveError(localResult.ok ? null : localResult.error);
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, hydrated, fileReady, workspace]);

  const setState = useCallback((updater: Updater) => {
    _setState((prev) => {
      const next = applyUpdater(updater, prev);
      if (next === prev) return prev;
      const now = Date.now();
      if (now - lastPushAt.current > COALESCE_MS) {
        pastRef.current.push(prev);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
        futureRef.current.length = 0;
      }
      lastPushAt.current = now;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    _setState((cur) => {
      const prev = pastRef.current.pop();
      if (prev === undefined) return cur;
      futureRef.current.push(cur);
      // Reset coalescing so the next edit after an undo creates a fresh history entry.
      lastPushAt.current = 0;
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    _setState((cur) => {
      const next = futureRef.current.pop();
      if (next === undefined) return cur;
      pastRef.current.push(cur);
      lastPushAt.current = 0;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    // The rename control is hidden, so a reset must never clobber the
    // project name — keep it, falling back to the folder name.
    setState((prev) => ({
      ...DEFAULT_PROJECT,
      appName: prev.appName.trim() || (workspace ? workspaceName(workspace) : ""),
    }));
  }, [setState, workspace]);

  const resetDevice = useCallback((device: Device) => {
    setState((prev) => ({
      ...prev,
      slidesByDevice: {
        ...prev.slidesByDevice,
        [device]: DEFAULT_PROJECT.slidesByDevice[device],
      },
    }));
  }, [setState]);

  // Manual save: flush any pending debounced write and persist immediately.
  // Guarded by fileReady so a failed load can't be papered over with a
  // possibly-blank state.
  const saveNow = useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!workspace) return { ok: false, error: "No workspace selected" };
    if (!fileReady) return { ok: false, error: "Project file isn't loaded yet" };
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const snap = stateRef.current;
    setSaving(true);
    try {
      const localResult = saveToLocalStorage(workspace, snap);
      const fileResult = await saveToFile(workspace, snap);
      if (fileResult.ok && localResult.ok) {
        setSavedAt(Date.now());
        setSaveError(null);
        return { ok: true };
      }
      let error: string;
      if (!fileResult.ok) {
        error = `File save failed: ${fileResult.error}`;
      } else if (!localResult.ok) {
        error = localResult.error;
      } else {
        error = "Unknown save error";
      }
      if (localResult.ok) setSavedAt(Date.now());
      setSaveError(error);
      return { ok: false, error };
    } finally {
      setSaving(false);
    }
  }, [workspace, fileReady]);

  return {
    state,
    setState,
    hydrated,
    savedAt,
    saveError,
    saving,
    saveNow,
    reset,
    resetDevice,
    undo,
    redo,
  };
}
