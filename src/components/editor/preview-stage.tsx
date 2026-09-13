"use client";
import * as React from "react";
import { Copy, Magnet, Maximize2, Ruler, Type, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DEVICE_LABEL, LAYOUT_LABEL } from "@/lib/constants";
import type {
  CanvasSize,
  Device,
  ElementId,
  ElementTransform,
  FrameFinish,
  GlobalTextStyle,
  ScreenBackground,
  SelectedElement,
  Slide,
  SlideLayout,
  Theme,
} from "@/lib/types";
import { DeckCanvas, ISOLATED_SCREEN_GAP, getCanvas } from "./slide-canvas";
import { LeftRuler, TopRuler, loadRulers, saveRulers } from "./rulers";
import type { RulerHandle, RulerSnapshot } from "./rulers";
import { loadGuides, saveGuides } from "@/lib/guides";
import type { Guide, GuideAxis } from "@/lib/guides";
import { loadSnap, saveSnap } from "@/lib/snap";

const ZOOM_KEY = "screenshots.zoom";

function loadZoom(device: Device): number {
  if (typeof window === "undefined") return 1;
  try {
    const n = Number(window.localStorage.getItem(`${ZOOM_KEY}:${device}`));
    if (Number.isFinite(n)) return Math.min(2, Math.max(0.25, n));
  } catch {
    // storage unavailable — fall through to the default zoom
  }
  return 1;
}

type Props = {
  slides: Slide[];
  activeSlideId: string | null;
  device: Device;
  theme: Theme;
  locale: string;
  connectedCanvas: boolean;
  selectedElement: SelectedElement | null;
  selectedPeers?: SelectedElement[];
  headlineFont?: string;
  labelFont?: string;
  background?: ScreenBackground;
  /** Active workspace id (path). Guides are stored per workspace + device. */
  workspaceKey: string | null;
  onActiveSlideChange: (id: string) => void;
  onLabelChange: (slide: Slide, v: string) => void;
  onHeadlineChange: (slide: Slide, v: string) => void;
  onTextElementTextChange: (slideId: string, id: string, v: string) => void;
  onElementChange: (slideId: string, id: ElementId, t: ElementTransform) => void;
  onSelectElement: (element: SelectedElement | null, additive?: boolean) => void;
  onRenameScreen?: (slideId: string, name: string) => void;
  sizes?: Partial<Record<Device, CanvasSize>>;
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  // Figma-style floating dock (essentials v1)
  onAddText?: () => void;
  onDuplicateScreen?: () => void;
  slideLayout?: SlideLayout;
  onLayoutChange?: (layout: SlideLayout) => void;
  dockDisabled?: boolean;
};

// Fits one full-resolution screen inside the viewport while keeping the whole
// deck horizontally scrollable as one connected canvas.
export function PreviewStage({
  slides,
  activeSlideId,
  device,
  theme,
  locale,
  connectedCanvas,
  selectedElement,
  selectedPeers,
  headlineFont,
  labelFont,
  background,
  workspaceKey,
  onActiveSlideChange,
  onLabelChange,
  onHeadlineChange,
  onTextElementTextChange,
  onElementChange,
  onSelectElement,
  onRenameScreen,
  sizes,
  frames,
  headlineText,
  labelText,
  onAddText,
  onDuplicateScreen,
  slideLayout,
  onLayoutChange,
  dockDisabled,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const topRulerRef = React.useRef<RulerHandle>(null);
  const leftRulerRef = React.useRef<RulerHandle>(null);
  const rafRef = React.useRef(0);
  const suppressNextActiveScreenPanRef = React.useRef(false);
  const [fitScale, setFitScale] = React.useState(0.2);
  const [zoom, setZoom] = React.useState(() => loadZoom(device));
  const [rulersOn, setRulersOn] = React.useState(() => loadRulers());
  const [snapOn, setSnapOn] = React.useState(() => loadSnap());
  // Live ruler geometry. Mutated (never setState) so scroll/move updates stay
  // off the render path; rulers repaint imperatively via requestAnimationFrame.
  const snapRef = React.useRef<RulerSnapshot>({
    scale: 0.2,
    scrollX: 0,
    scrollY: 0,
    padL: 0,
    padT: 0,
    viewW: 0,
    viewH: 0,
    cursorX: null,
    cursorY: null,
    totalW: 0,
    cH: 0,
  });
  const [guides, setGuides] = React.useState<Guide[]>(() => loadGuides(workspaceKey, device));
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const dragRef = React.useRef<{
    id: string;
    axis: GuideAxis;
    startX: number;
    startY: number;
    startPos: number;
    created: boolean;
    moved: boolean;
  } | null>(null);
  const guideIdRef = React.useRef(0);
  const topRulerWrapRef = React.useRef<HTMLDivElement>(null);
  const leftRulerWrapRef = React.useRef<HTMLDivElement>(null);
  const { cW, cH } = getCanvas(device, sizes);
  // Isolated screens get breathing room between pages; connected decks stay
  // seamless because they render and export as one strip.
  const gap = connectedCanvas ? 0 : ISOLATED_SCREEN_GAP;
  const totalW = Math.max(1, slides.length) * cW + Math.max(0, slides.length - 1) * gap;
  const scale = fitScale * zoom;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlideId));
  const activeSlide = slides[activeIndex] || slides[0] || null;

  const redrawRulers = React.useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      topRulerRef.current?.redraw();
      leftRulerRef.current?.redraw();
    });
  }, []);

  // Deck origin inside the scroller viewport, derived from live rects so it
  // stays correct across the responsive padding (p-6/pt-12, sm:p-10/sm:pt-14).
  const syncRulerViewport = React.useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const s = snapRef.current;
    s.scrollX = sc.scrollLeft;
    s.scrollY = sc.scrollTop;
    s.viewW = sc.clientWidth;
    s.viewH = sc.clientHeight;
    const content = contentRef.current;
    if (content) {
      const scRect = sc.getBoundingClientRect();
      const cRect = content.getBoundingClientRect();
      s.padL = cRect.left - scRect.left + sc.scrollLeft;
      s.padT = cRect.top - scRect.top + sc.scrollTop;
    }
    redrawRulers();
  }, [redrawRulers]);

  const getSnapshot = React.useCallback(() => snapRef.current, []);

  const toggleRulers = React.useCallback(() => {
    setRulersOn((prev) => {
      const next = !prev;
      saveRulers(next);
      return next;
    });
  }, []);

  const toggleSnap = React.useCallback(() => {
    setSnapOn((prev) => {
      const next = !prev;
      saveSnap(next);
      return next;
    });
  }, []);

  const handleScrollerScroll = React.useCallback(() => {
    syncRulerViewport();
  }, [syncRulerViewport]);

  const handleScrollerMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      const sc = scrollerRef.current;
      if (!sc) return;
      const s = snapRef.current;
      const rect = sc.getBoundingClientRect();
      const scale = Math.max(s.scale, 1e-6);
      s.cursorX = (e.clientX - rect.left + s.scrollX - s.padL) / scale;
      s.cursorY = (e.clientY - rect.top + s.scrollY - s.padT) / scale;
      redrawRulers();
    },
    [redrawRulers],
  );

  const handleScrollerMouseLeave = React.useCallback(() => {
    snapRef.current.cursorX = null;
    snapRef.current.cursorY = null;
    redrawRulers();
  }, [redrawRulers]);

  // Canvas-px guide position under the pointer (same origin math as rulers).
  const guidePosFromClient = React.useCallback(
    (clientX: number, clientY: number, axis: GuideAxis): number | null => {
      const sc = scrollerRef.current;
      if (!sc) return null;
      const s = snapRef.current;
      const rect = sc.getBoundingClientRect();
      const scale = Math.max(s.scale, 1e-6);
      return axis === "v"
        ? (clientX - rect.left + s.scrollX - s.padL) / scale
        : (clientY - rect.top + s.scrollY - s.padT) / scale;
    },
    [],
  );

  // Figma parity: releasing a guide over either ruler bar deletes it.
  const pointerOverRulers = React.useCallback((clientX: number, clientY: number) => {
    for (const bar of [topRulerWrapRef.current, leftRulerWrapRef.current]) {
      if (!bar) continue;
      const r = bar.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return true;
      }
    }
    return false;
  }, []);

  const removeGuide = React.useCallback((id: string) => {
    setGuides((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const onGuidePointerDown = React.useCallback((e: React.PointerEvent, guide: Guide) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id: guide.id,
      axis: guide.axis,
      startX: e.clientX,
      startY: e.clientY,
      startPos: guide.pos,
      created: false,
      moved: false,
    };
    setDraggingId(guide.id);
  }, []);

  // Pull a new guide out of a ruler bar (capture keeps events flowing here).
  const onRulerPointerDown = React.useCallback(
    (e: React.PointerEvent, axis: GuideAxis) => {
      if (e.button !== 0) return;
      const pos = guidePosFromClient(e.clientX, e.clientY, axis);
      if (pos == null || !Number.isFinite(pos)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      guideIdRef.current += 1;
      const id = `g_${Date.now().toString(36)}_${guideIdRef.current}`;
      setGuides((prev) => [...prev, { id, axis, pos }]);
      dragRef.current = {
        id,
        axis,
        startX: e.clientX,
        startY: e.clientY,
        startPos: pos,
        created: true,
        moved: false,
      };
      setDraggingId(id);
    },
    [guidePosFromClient],
  );

  const onGuidePointerMove = React.useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const scale = Math.max(snapRef.current.scale, 1e-6);
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 3) {
      d.moved = true;
    }
    const delta =
      d.axis === "v" ? (e.clientX - d.startX) / scale : (e.clientY - d.startY) / scale;
    const pos = d.startPos + delta;
    setGuides((prev) => prev.map((g) => (g.id === d.id ? { ...g, pos } : g)));
  }, []);

  const onGuidePointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      if (!d) return;
      // A bare click on a ruler creates nothing; dragging back onto a ruler deletes.
      if ((d.created && !d.moved) || pointerOverRulers(e.clientX, e.clientY)) {
        removeGuide(d.id);
      }
    },
    [pointerOverRulers, removeGuide],
  );

  const onGuideDoubleClick = React.useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeGuide(id);
    },
    [removeGuide],
  );

  // An interrupted drag (touch scroll takeover, alert, window blur) must never
  // wedge the drag state — that would block all persistence saves, which skip
  // while a drag is active. Commit the last position and resume saving.
  const onGuidePointerCancel = React.useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!d) return;
    // A pull that never left the ruler leaves no trace.
    if (d.created && !d.moved) removeGuide(d.id);
  }, [removeGuide]);

  // Keyboard access: arrows nudge (Shift = big step), Delete removes.
  const onGuideKeyDown = React.useCallback(
    (e: React.KeyboardEvent, guide: Guide) => {
      const big = e.shiftKey ? 10 : 1;
      let delta: number | null = null;
      if (guide.axis === "v" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        delta = (e.key === "ArrowRight" ? big : -big);
      } else if (
        guide.axis === "h" &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        delta = (e.key === "ArrowDown" ? big : -big);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        removeGuide(guide.id);
        return;
      } else {
        return;
      }
      e.preventDefault();
      setGuides((prev) =>
        prev.map((g) => (g.id === guide.id ? { ...g, pos: g.pos + (delta ?? 0) } : g)),
      );
    },
    [removeGuide],
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      // Measure the scroll viewport (not the outer box) so the ruler chrome
      // is excluded from the fit math when visible.
      const sc = scrollerRef.current;
      const rect = el.getBoundingClientRect();
      const w = sc ? sc.clientWidth : rect.width;
      const h = sc ? sc.clientHeight : rect.height;
      const sx = (w - 96) / cW;
      const sy = (h - 96) / cH;
      setFitScale(Math.max(0.05, Math.min(sx, sy)));
      syncRulerViewport();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const sc = scrollerRef.current;
    if (sc) ro.observe(sc);
    return () => ro.disconnect();
  }, [cW, cH, syncRulerViewport]);

  // Guides persist per workspace + device; reload on switch, skip saves mid-drag.
  React.useEffect(() => {
    setGuides(loadGuides(workspaceKey, device));
  }, [workspaceKey, device]);

  React.useEffect(() => {
    if (draggingId) return;
    saveGuides(workspaceKey, device, guides);
  }, [workspaceKey, device, guides, draggingId]);

  // Keep ruler geometry current across zoom, deck edits, toggle, and theme.
  React.useEffect(() => {
    const s = snapRef.current;
    s.scale = scale;
    s.totalW = totalW;
    s.cH = cH;
    syncRulerViewport();
  }, [scale, totalW, cH, rulersOn, theme, syncRulerViewport]);

  // Figma parity: Shift+R toggles rulers. Ignored while typing.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.key.toLowerCase() === "r") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        toggleRulers();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleRulers]);

  // Drop any queued ruler repaint on unmount.
  React.useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Zoom persists per device across reloads and device switches.
  React.useEffect(() => {
    setZoom(loadZoom(device));
  }, [device]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(`${ZOOM_KEY}:${device}`, String(zoom));
    } catch {
      // storage unavailable (private mode etc.) — zoom still applies
    }
  }, [zoom, device]);

  React.useEffect(() => {
    if (suppressNextActiveScreenPanRef.current) {
      suppressNextActiveScreenPanRef.current = false;
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller || !activeSlide) return;
    const screenLeft = activeIndex * (cW + gap) * scale;
    const screenWidth = cW * scale;
    const targetLeft = Math.max(0, screenLeft - (scroller.clientWidth - screenWidth) / 2);
    const smooth =
      typeof window !== "undefined" &&
      window.matchMedia &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left: targetLeft, behavior: smooth ? "smooth" : "auto" });
  }, [activeIndex, activeSlide, cW, gap, scale]);

  const handleCanvasActiveSlideChange = React.useCallback(
    (id: string) => {
      if (id !== activeSlideId) {
        suppressNextActiveScreenPanRef.current = true;
      }
      onActiveSlideChange(id);
    },
    [activeSlideId, onActiveSlideChange],
  );

  // Slide lookup via ref so the edit-handler object keeps a stable identity
  // across keystrokes (the slides array identity churns on every edit).
  const slidesRef = React.useRef(slides);
  React.useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);
  const deckEdit = React.useMemo(
    () => ({
      onLabelChange: (slideId: string, value: string) => {
        const slide = slidesRef.current.find((s) => s.id === slideId);
        if (slide) onLabelChange(slide, value);
      },
      onHeadlineChange: (slideId: string, value: string) => {
        const slide = slidesRef.current.find((s) => s.id === slideId);
        if (slide) onHeadlineChange(slide, value);
      },
      onTextElementTextChange,
      onElementChange,
      onSelectElement,
      onSelectScreen: handleCanvasActiveSlideChange,
      onRenameScreen,
    }),
    [
      onLabelChange,
      onHeadlineChange,
      onTextElementTextChange,
      onElementChange,
      onSelectElement,
      handleCanvasActiveSlideChange,
      onRenameScreen,
    ],
  );

  return (
    <div className="figma-canvas-bg relative flex h-full w-full flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-figma-divider bg-figma-panel px-3 text-[12px] text-figma-secondary">
        <span className="shrink-0 font-semibold text-figma-text">{DEVICE_LABEL[device]}</span>
        {activeSlide && (
          <>
            <span aria-hidden className="shrink-0 text-border">|</span>
            <span className="shrink-0 tabular-nums">Screen {activeIndex + 1} of {slides.length}</span>
            <span aria-hidden className="hidden shrink-0 text-border sm:inline">|</span>
            <span className="hidden min-w-0 truncate sm:inline">{LAYOUT_LABEL[activeSlide.layout]}</span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md border border-figma-divider bg-figma-panel p-0.5 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded text-figma-secondary hover:text-figma-text data-[pressed=true]:bg-figma-hover data-[pressed=true]:text-figma-text"
            onClick={toggleRulers}
            title="Toggle rulers (Shift+R)"
            aria-label="Toggle rulers"
            aria-pressed={rulersOn}
            data-pressed={rulersOn}
          >
            <Ruler className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded text-figma-secondary hover:text-figma-text data-[pressed=true]:bg-figma-hover data-[pressed=true]:text-figma-text"
            onClick={toggleSnap}
            title={snapOn ? "Disable snapping (hold Ctrl to suspend while dragging)" : "Enable snapping"}
            aria-label="Toggle snapping"
            aria-pressed={snapOn}
            data-pressed={snapOn}
          >
            <Magnet className="h-3.5 w-3.5" />
          </Button>
          <span className="hidden px-1.5 text-[11px] tabular-nums lg:inline">{cW}×{cH}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded text-figma-secondary hover:text-figma-text"
            onClick={() => setZoom((value) => Math.max(0.25, Number((value - 0.1).toFixed(2))))}
            disabled={zoom <= 0.25}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Reset to 100% fit"
            className="min-w-12 rounded px-1.5 py-1 text-center text-[11px] font-medium tabular-nums text-figma-text hover:bg-figma-hover"
          >
            {(scale * 100).toFixed(0)}%
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded text-figma-secondary hover:text-figma-text"
            onClick={() => setZoom((value) => Math.min(2, Number((value + 0.1).toFixed(2))))}
            disabled={zoom >= 2}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded text-figma-secondary hover:text-figma-text"
            onClick={() => setZoom(1)}
            title="Fit active screen"
            aria-label="Fit active screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {rulersOn ? (
        <div
          ref={topRulerWrapRef}
          className="hidden h-6 shrink-0 cursor-ns-resize touch-pan-x touch-pan-y flex-row border-b border-figma-divider sm:flex"
          title="Drag onto the canvas to add a horizontal guide"
          onPointerDown={(e) => onRulerPointerDown(e, "h")}
          onPointerMove={onGuidePointerMove}
          onPointerUp={onGuidePointerUp}
          onPointerCancel={onGuidePointerCancel}
        >
          <div className="w-6 shrink-0 border-r border-figma-divider bg-figma-panel" aria-hidden="true" />
          <div className="min-w-0 flex-1 bg-figma-panel">
            <TopRuler ref={topRulerRef} getSnapshot={getSnapshot} />
          </div>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
      {rulersOn ? (
        <div
          ref={leftRulerWrapRef}
          className="hidden w-6 shrink-0 cursor-ew-resize touch-pan-x touch-pan-y border-r border-figma-divider bg-figma-panel sm:block"
          title="Drag onto the canvas to add a vertical guide"
          onPointerDown={(e) => onRulerPointerDown(e, "v")}
          onPointerMove={onGuidePointerMove}
          onPointerUp={onGuidePointerUp}
          onPointerCancel={onGuidePointerCancel}
        >
          <LeftRuler ref={leftRulerRef} getSnapshot={getSnapshot} />
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        onScroll={handleScrollerScroll}
        onMouseMove={handleScrollerMouseMove}
        onMouseLeave={handleScrollerMouseLeave}
        className="figma-thin-scroll min-h-0 min-w-0 flex-1 overflow-auto p-6 pt-12 sm:p-10 sm:pt-14"
      >
        <div
          ref={contentRef}
          style={{
            width: totalW * scale,
            height: cH * scale,
            position: "relative",
            flexShrink: 0,
            filter: "drop-shadow(0 8px 32px rgba(0, 0, 0, 0.16))",
          }}
        >
          <div
            style={{
              width: totalW,
              height: cH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <DeckCanvas
              slides={slides}
              device={device}
              theme={theme}
              locale={locale}
              connectedCanvas={connectedCanvas}
              gap={gap}
              editable
              previewScale={scale}
              selectedElement={selectedElement}
              activeSlideId={activeSlide?.id || null}
              showGuides
              headlineFont={headlineFont}
              labelFont={labelFont}
              background={background}
              frames={frames}
              sizes={sizes}
              headlineText={headlineText}
              labelText={labelText}
              guides={guides}
              snapEnabled={snapOn}
              selectedPeers={selectedPeers}
              edit={deckEdit}
            />
          </div>
          {/* Draggable ruler guides — editor chrome, never exported. */}
          <div className="pointer-events-none absolute inset-0 select-none">
            {guides.map((g) => {
              const p = g.pos * scale;
              const active = draggingId === g.id;
              const label = `${Math.round(g.pos)}px`;
              const hint =
                g.axis === "v"
                  ? `Vertical guide at ${label}. Drag to move, double-click to delete.`
                  : `Horizontal guide at ${label}. Drag to move, double-click to delete.`;
              return g.axis === "v" ? (
                <div key={g.id} className="absolute bottom-0 top-0" style={{ left: p }}>
                  <div
                    aria-hidden="true"
                    className="absolute bottom-0 top-0 w-px"
                    style={{ background: "#0d99ff", opacity: active ? 1 : 0.8 }}
                  />
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={hint}
                    aria-valuenow={Math.round(g.pos)}
                    aria-valuetext={label}
                    title={hint}
                    tabIndex={0}
                    className="pointer-events-auto absolute bottom-0 top-0 cursor-ew-resize touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d99ff]"
                    style={{ left: -6, width: 12 }}
                    onPointerDown={(e) => onGuidePointerDown(e, g)}
                    onPointerMove={onGuidePointerMove}
                    onPointerUp={onGuidePointerUp}
                    onPointerCancel={onGuidePointerCancel}
                    onDoubleClick={(e) => onGuideDoubleClick(e, g.id)}
                    onKeyDown={(e) => onGuideKeyDown(e, g)}
                  />
                  {active ? (
                    <div className="absolute left-2 top-2 rounded border border-figma-divider bg-figma-panel px-1 py-0.5 text-[10px] tabular-nums text-figma-text shadow">
                      {label}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div key={g.id} className="absolute left-0 right-0" style={{ top: p }}>
                  <div
                    aria-hidden="true"
                    className="absolute left-0 right-0 h-px"
                    style={{ background: "#0d99ff", opacity: active ? 1 : 0.8 }}
                  />
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label={hint}
                    aria-valuenow={Math.round(g.pos)}
                    aria-valuetext={label}
                    title={hint}
                    tabIndex={0}
                    className="pointer-events-auto absolute left-0 right-0 cursor-ns-resize touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0d99ff]"
                    style={{ top: -6, height: 12 }}
                    onPointerDown={(e) => onGuidePointerDown(e, g)}
                    onPointerMove={onGuidePointerMove}
                    onPointerUp={onGuidePointerUp}
                    onPointerCancel={onGuidePointerCancel}
                    onDoubleClick={(e) => onGuideDoubleClick(e, g.id)}
                    onKeyDown={(e) => onGuideKeyDown(e, g)}
                  />
                  {active ? (
                    <div className="absolute left-2 top-2 rounded border border-figma-divider bg-figma-panel px-1 py-0.5 text-[10px] tabular-nums text-figma-text shadow">
                      {label}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>

      </div>
      {/* Floating Figma-style dock: quick element actions */}
      {activeSlide ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-figma-divider bg-figma-panel p-1 shadow-lg">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px] text-figma-text"
              onClick={onAddText}
              disabled={dockDisabled || !onAddText}
              title="Add text (T)"
              aria-label="Add text element"
            >
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">Text</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px] text-figma-text"
              onClick={onDuplicateScreen}
              disabled={dockDisabled || !onDuplicateScreen}
              title="Duplicate screen (Cmd/Ctrl+D)"
              aria-label="Duplicate screen"
            >
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Duplicate</span>
            </Button>
            {slideLayout && onLayoutChange ? (
              <>
                <Separator orientation="vertical" className="h-5 bg-figma-divider" />
                <Select
                  value={slideLayout}
                  onValueChange={(v) => onLayoutChange(v as SlideLayout)}
                  disabled={dockDisabled}
                >
                  <SelectTrigger
                    className="h-8 w-32 border-0 bg-transparent text-[12px] shadow-none"
                    aria-label="Screen layout"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LAYOUT_LABEL).map(([layout, label]) => (
                      <SelectItem key={layout} value={layout}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <Separator orientation="vertical" className="h-5 bg-figma-divider" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-figma-secondary hover:text-figma-text"
              onClick={() => setZoom(1)}
              title="Zoom to fit"
              aria-label="Zoom to fit"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
