"use client";
import * as React from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEVICE_LABEL, LAYOUT_LABEL } from "@/lib/constants";
import type {
  Device,
  ElementId,
  ElementTransform,
  ScreenBackground,
  SelectedElement,
  Slide,
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
    }),
    [
      onLabelChange,
      onHeadlineChange,
      onTextElementTextChange,
      onElementChange,
      onSelectElement,
      handleCanvasActiveSlideChange,
    ],
  );

  return (
    <div className="figma-canvas-bg flex h-full w-full flex-col overflow-hidden">
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
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
      <div ref={scrollerRef} className="figma-thin-scroll h-full w-full overflow-auto p-6 sm:p-10">
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
    </div>
  );
}
