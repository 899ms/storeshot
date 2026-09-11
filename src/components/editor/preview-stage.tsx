"use client";
import * as React from "react";
import { Copy, Maximize2, Type, ZoomIn, ZoomOut } from "lucide-react";
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
  Device,
  ElementId,
  ElementTransform,
  ScreenBackground,
  SelectedElement,
  Slide,
  SlideLayout,
  Theme,
} from "@/lib/types";
import { DeckCanvas, ISOLATED_SCREEN_GAP, getCanvas } from "./slide-canvas";

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
  headlineFont?: string;
  labelFont?: string;
  background?: ScreenBackground;
  onActiveSlideChange: (id: string) => void;
  onLabelChange: (slide: Slide, v: string) => void;
  onHeadlineChange: (slide: Slide, v: string) => void;
  onTextElementTextChange: (slideId: string, id: string, v: string) => void;
  onElementChange: (slideId: string, id: ElementId, t: ElementTransform) => void;
  onSelectElement: (element: SelectedElement | null) => void;
  onRenameScreen?: (slideId: string, name: string) => void;
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
  headlineFont,
  labelFont,
  background,
  onActiveSlideChange,
  onLabelChange,
  onHeadlineChange,
  onTextElementTextChange,
  onElementChange,
  onSelectElement,
  onRenameScreen,
  onAddText,
  onDuplicateScreen,
  slideLayout,
  onLayoutChange,
  dockDisabled,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const suppressNextActiveScreenPanRef = React.useRef(false);
  const [fitScale, setFitScale] = React.useState(0.2);
  const [zoom, setZoom] = React.useState(() => loadZoom(device));
  const { cW, cH } = getCanvas(device);
  // Isolated screens get breathing room between pages; connected decks stay
  // seamless because they render and export as one strip.
  const gap = connectedCanvas ? 0 : ISOLATED_SCREEN_GAP;
  const totalW = Math.max(1, slides.length) * cW + Math.max(0, slides.length - 1) * gap;
  const scale = fitScale * zoom;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlideId));
  const activeSlide = slides[activeIndex] || slides[0] || null;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const sx = (rect.width - 96) / cW;
      const sy = (rect.height - 96) / cH;
      setFitScale(Math.max(0.05, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cW, cH]);

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
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
      <div ref={scrollerRef} className="figma-thin-scroll h-full w-full overflow-auto p-6 pt-12 sm:p-10 sm:pt-14">
        <div
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
              edit={deckEdit}
            />
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
