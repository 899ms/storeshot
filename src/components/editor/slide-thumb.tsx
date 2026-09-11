"use client";
import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LAYOUT_LABEL } from "@/lib/constants";
import { pickText } from "@/lib/locale";
import { screenDisplayName, screenIndexPrefix } from "@/lib/screen-title";
import type { CanvasSize, Device, FrameFinish, GlobalTextStyle, ScreenBackground, Slide, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeckCanvas, SlideCanvas, getCanvas } from "./slide-canvas";

type Props = {
  slide: Slide;
  slides: Slide[];
  index: number;
  active: boolean;
  device: Device;
  theme: Theme;
  locale: string;
  connectedCanvas: boolean;
  headlineFont?: string;
  labelFont?: string;
  background?: ScreenBackground;
  sizes?: Partial<Record<Device, CanvasSize>>;
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

// Thumb tile target width (pixels). Height is derived from device aspect.
const THUMB_W = 60;

function SlideThumbInner({
  slide,
  slides,
  index,
  active,
  device,
  theme,
  locale,
  connectedCanvas,
  headlineFont,
  labelFont,
  background,
  sizes,
  frames,
  headlineText,
  labelText,
  onSelect,
  onDelete,
  onDuplicate,
}: Props) {
  const headline = pickText(slide.headline, locale);
  const label = pickText(slide.label, locale);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slide.id,
  });

  const { cW, cH } = getCanvas(device, sizes);
  const aspect = cW / cH;
  const tileH = Math.max(34, Math.min(120, Math.round(THUMB_W / aspect)));
  const scale = THUMB_W / cW;
  const start = connectedCanvas ? Math.max(0, index - 1) : index;
  const visibleSlides = connectedCanvas ? slides.slice(start, Math.min(slides.length, index + 2)) : [slide];
  const localIndex = index - start;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-stretch gap-1.5 rounded-md border border-transparent bg-transparent p-1.5 shadow-none transition-colors figma-row-hover",
        active && "border-figma-accent bg-figma-accent-soft ring-1 ring-figma-accent",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-auto w-3 shrink-0 cursor-grab self-stretch rounded-sm text-figma-secondary/60 hover:text-figma-text active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`Reorder screen ${index + 1} (press space, then arrow keys)`}
      >
        <GripVertical className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        className="h-auto flex-1 items-center justify-start gap-2.5 overflow-hidden rounded p-0 text-left font-normal hover:bg-transparent"
      >
        <div
          aria-hidden
          className="relative shrink-0 overflow-hidden rounded border border-figma-divider bg-figma-hover"
          style={{ width: THUMB_W, height: tileH }}
        >
          <div
            style={{
              width: cW * visibleSlides.length,
              height: cH,
              position: "absolute",
              top: 0,
              left: -localIndex * cW * scale,
              transformOrigin: "top left",
              transform: `scale(${scale})`,
              pointerEvents: "none",
            }}
          >
            {connectedCanvas ? (
              <DeckCanvas
                slides={visibleSlides}
                device={device}
                theme={theme}
                locale={locale}
                connectedCanvas
                editable={false}
                headlineFont={headlineFont}
                labelFont={labelFont}
                background={background}
                frames={frames}
                sizes={sizes}
                headlineText={headlineText}
                labelText={labelText}
              />
            ) : (
              <SlideCanvas
                slide={slide}
                device={device}
                theme={theme}
                locale={locale}
                editable={false}
                headlineFont={headlineFont}
                labelFont={labelFont}
                background={background}
                frames={frames}
                sizes={sizes}
                headlineText={headlineText}
                labelText={labelText}
              />
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[10px] font-medium uppercase tracking-wide text-figma-secondary">
            {`${screenIndexPrefix(index)} · ${screenDisplayName(slide, LAYOUT_LABEL[slide.layout])}`}
          </span>
          <span className="truncate text-[12px] font-medium leading-tight text-figma-text">
            {headline.split("\n")[0] || (
              <em className="font-normal text-figma-secondary">Untitled</em>
            )}
          </span>
          {label ? (
            <span className="truncate text-[10px] uppercase tracking-wide text-figma-secondary">
              {label}
            </span>
          ) : null}
        </div>
      </Button>

      {/* Always visible on touch (no hover); fades in on hover on desktop. */}
      <div className="flex flex-col items-center justify-center gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onDuplicate}
          aria-label={`Duplicate screen ${index + 1}`}
          title="Duplicate screen"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete screen ${index + 1}`}
          title="Delete screen (undoable)"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

// Callback props are stable editor-level callbacks by construction, so they
// are intentionally excluded: a thumb re-renders only when its own slide,
// its visible neighbors, or its display props change — never on unrelated
// keystrokes elsewhere in the deck.
function sameSlides(a: Slide[], b: Slide[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const SlideThumb = React.memo(SlideThumbInner, (prev, next) => {
  if (prev.index !== next.index) return false;
  if (!sameSlides(prev.slides, next.slides)) return false;
  return (
    prev.slide === next.slide &&
    prev.active === next.active &&
    prev.device === next.device &&
    prev.theme === next.theme &&
    prev.locale === next.locale &&
    prev.connectedCanvas === next.connectedCanvas &&
    prev.headlineFont === next.headlineFont &&
    prev.labelFont === next.labelFont &&
    prev.background === next.background &&
    prev.sizes === next.sizes &&
    prev.frames === next.frames &&
    prev.headlineText === next.headlineText &&
    prev.labelText === next.labelText
  );
});
