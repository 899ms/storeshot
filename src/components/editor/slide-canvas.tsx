"use client";
import * as React from "react";
import { Rnd } from "react-rnd";
import { RotateCw } from "lucide-react";
import type {
  BuiltInElementId,
  CanvasSize,
  Device,
  GlobalTextStyle,
  ElementId,
  ElementTransform,
  FrameFinish,
  ScreenBackground,
  SelectedElement,
  Slide,
  TextElement,
  Theme,
} from "@/lib/types";
import {
  DESKTOP_RATIO,
  IPAD_MK_RATIO,
  MK_RATIO,
  desktopW,
  desktopWSmall,
  effectiveCanvas,
  phoneW,
  phoneWSmall,
  tabletW,
  tabletWSmall,
} from "@/lib/constants";
import { toTextElementId } from "@/lib/elements";
import type { Guide } from "@/lib/guides";
import { SNAP_THRESHOLD, buildSnapTargets, snapDrag, snapThresholdForScale } from "@/lib/snap";
import type { SnapLine, SnapRect } from "@/lib/snap";
import { img } from "@/lib/image-cache";
import { pickText, resolveScreenshot, isRtlLocale } from "@/lib/locale";
import { screenCanvasLabel } from "@/lib/screen-title";
import { fontStack } from "@/lib/fonts";
import { resolveHeadlineStyle, resolveLabelStyle } from "@/lib/caption-style";
import { DEFAULT_HEADLINE_FONT, DEFAULT_LABEL_FONT } from "@/lib/defaults";
import { Frameless, IPad, Phone } from "./device-frames";

type FrameComp = React.ComponentType<{
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  hideEmpty?: boolean;
  finish?: FrameFinish;
}>;

export function getCanvas(device?: Device, overrides?: Partial<Record<Device, CanvasSize>>) {
  const c = effectiveCanvas(device ?? "phone", overrides);
  return { cW: c.w, cH: c.h };
}

// Aspect ratio (w/h) of each device frame — must match device-frames.tsx
function getFrameAspect(device?: Device) {
  if (device === "tablet") return IPAD_MK_RATIO;
  if (device === "desktop") return DESKTOP_RATIO;
  return MK_RATIO;
}

export function getFrameForDevice(device?: Device): {
  Comp: FrameComp;
  widthFn: (cW: number, cH: number) => number;
  smallWidthFn: (cW: number, cH: number) => number;
} {
  if (device === "tablet") return { Comp: IPad, widthFn: tabletW, smallWidthFn: tabletWSmall };
  if (device === "desktop") return { Comp: Frameless, widthFn: desktopW, smallWidthFn: desktopWSmall };
  return { Comp: Phone, widthFn: phoneW, smallWidthFn: phoneWSmall };
}

type EditHandlers = {
  onLabelChange?: (v: string) => void;
  onHeadlineChange?: (v: string) => void;
  onTextElementTextChange?: (id: string, v: string) => void;
  onElementChange?: (id: ElementId, t: ElementTransform) => void;
  /** additive = Shift-click toggles a multi-selection peer. */
  onSelectElement?: (id: ElementId | null, additive?: boolean) => void;
};

type Props = {
  slide: Slide;
  device: Device;
  theme: Theme;
  locale: string;
  editable?: boolean;
  edit?: EditHandlers;
  selectedElementId?: ElementId | null;
  // Preview scale (1.0 = full size). Used so react-rnd maps drag deltas correctly
  // when the canvas is rendered inside a CSS-transformed container.
  previewScale?: number;
  /** When true, suppress the "Drop a screenshot here" placeholder. Used for export. */
  hideEmpty?: boolean;
  /** Google Fonts family for the headline. Defaults to Nunito. */
  headlineFont?: string;
  /** Google Fonts family for the label + overlay texts. Defaults to Inter. */
  labelFont?: string;
  /** Project default background. A per-screen Slide.background wins. */
  background?: ScreenBackground;
  /** Mockup chassis finishes for Phone/Tablet. Absent = titanium. */
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  /** Per-device canvas size overrides. Absent = built-in defaults. */
  sizes?: Partial<Record<Device, CanvasSize>>;
  /** Project-wide Headline/Label defaults (Settings → Text). */
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
};

type DeckEditHandlers = {
  onLabelChange?: (slideId: string, v: string) => void;
  onHeadlineChange?: (slideId: string, v: string) => void;
  onTextElementTextChange?: (slideId: string, id: string, v: string) => void;
  onElementChange?: (slideId: string, id: ElementId, t: ElementTransform) => void;
  /** additive = Shift-click toggles a multi-selection peer. */
  onSelectElement?: (element: SelectedElement | null, additive?: boolean) => void;
  onSelectScreen?: (slideId: string) => void;
  onRenameScreen?: (slideId: string, name: string) => void;
};

export type { DeckEditHandlers };

type DeckCanvasProps = {
  slides: Slide[];
  device: Device;
  theme: Theme;
  locale: string;
  connectedCanvas?: boolean;
  editable?: boolean;
  edit?: DeckEditHandlers;
  selectedElement?: SelectedElement | null;
  /** Multi-selection peers (same-slide only). Stable array identity. */
  selectedPeers?: SelectedElement[];
  activeSlideId?: string | null;
  previewScale?: number;
  hideEmpty?: boolean;
  showGuides?: boolean;
  /** Google Fonts family for the headline. Defaults to Nunito. */
  headlineFont?: string;
  /** Google Fonts family for the label + overlay texts. Defaults to Inter. */
  labelFont?: string;
  /** Project default background. A per-screen Slide.background wins. */
  background?: ScreenBackground;
  /** Mockup chassis finishes for Phone/Tablet. Absent = titanium. */
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  /** Per-device canvas size overrides. Absent = built-in defaults. */
  sizes?: Partial<Record<Device, CanvasSize>>;
  /** Project-wide Headline/Label defaults (Settings → Text). */
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  /** Spacing between screens in canvas px. Preview uses it for isolated
   * decks so separate pages read as separate; export always uses 0. */
  gap?: number;
  /** Ruler guides (deck-global canvas px) for snap targets. Absent = no guide snap. */
  guides?: Guide[];
  /** Figma-style snap to canvas/elements/guides. Defaults to on. */
  snapEnabled?: boolean;
};

// Visible separation between isolated screens (canvas px). Connected decks
// stay seamless (gap 0) because they render and export as one strip.
export const ISOLATED_SCREEN_GAP = 96;

// ---------- Editable text helpers ----------

function EditableText({
  value,
  editable,
  onChange,
  style,
  multiline = false,
  placeholder,
  label,
  onFocus,
}: {
  value: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  label?: string;
  onFocus?: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = React.useRef(false);
  // Last text handed to onChange, plus the latest committed prop value — a
  // flush matching either is a no-op, so plain blurs never churn state,
  // history, or memo identities.
  const lastSentRef = React.useRef<string | null>(null);
  const valueLiveRef = React.useRef(value);
  React.useEffect(() => {
    valueLiveRef.current = value;
  }, [value]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const incoming = value || "";
    if (el.textContent !== incoming && document.activeElement !== el) {
      el.textContent = incoming;
    }
  }, [value]);
  // Cleanup pending commit on unmount without writing (the screen may be
  // gone; locale/screen switches always blur first, which flushes).
  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const readText = (el: HTMLDivElement) => {
    const text = (el.innerText || "").replace(/\u00a0/g, " ");
    return multiline ? text : text.replace(/\n/g, "");
  };

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const el = ref.current;
    if (!el || !onChange) return;
    const text = readText(el);
    if (text === lastSentRef.current || text === (valueLiveRef.current || "")) return;
    lastSentRef.current = text;
    onChange(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, multiline]);

  const handleInput = () => {
    if (!onChange) return;
    if (composingRef.current) return; // commit on compositionend instead
    if (timerRef.current) clearTimeout(timerRef.current);
    // DOM already shows the keystroke; the parent commit is debounced so a
    // typing burst re-renders the slide once, not per character. Blur always
    // flushes first (it fires before any toolbar/sidebar click takes effect).
    timerRef.current = setTimeout(flush, 250);
  };

  // Strip rich-text formatting on paste (web pages, docs, etc. carry inline
  // font sizes that would otherwise shrink the headline). Insert as plain
  // text so the canvas typography always wins.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.clipboardData.getData("text/plain");
    if (!raw) return;
    const clean = multiline ? raw : raw.replace(/[\r\n]+/g, " ");
    if (document.queryCommandSupported?.("insertText")) {
      document.execCommand("insertText", false, clean);
    } else {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      sel.deleteFromDocument();
      sel.getRangeAt(0).insertNode(document.createTextNode(clean));
      sel.collapseToEnd();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      role={editable ? "textbox" : undefined}
      aria-label={editable ? label : undefined}
      aria-multiline={editable ? multiline || undefined : undefined}
      aria-placeholder={editable ? placeholder : undefined}
      onInput={handleInput}
      onPaste={handlePaste}
      onFocus={() => onFocus?.()}
      onBlur={() => flush()}
      onCompositionStart={() => {
        composingRef.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        flush();
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onMouseDown={(e) => {
        // Allow text editing without starting an Rnd drag.
        if (editable) {
          e.stopPropagation();
          onFocus?.();
        }
      }}
      onPointerDown={(e) => {
        if (editable) e.stopPropagation();
      }}
      style={{
        outline: "none",
        whiteSpace: multiline ? "pre-wrap" : "nowrap",
        cursor: editable ? "text" : "default",
        ...style,
      }}
    />
  );
}

// ---------- Caption (label + headline) ----------

function Caption({
  cW,
  cH,
  slide,
  theme,
  locale,
  editable,
  edit,
  align = "center",
  inverted,
  headlineFont,
  labelFont,
  headlineText,
  labelText,
  onFocus,
}: {
  cW: number;
  cH: number;
  slide: Slide;
  theme: Theme;
  locale: string;
  editable?: boolean;
  edit?: EditHandlers;
  align?: "center" | "left";
  inverted?: boolean;
  headlineFont?: string;
  labelFont?: string;
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  onFocus?: () => void;
}) {
  const fg = inverted ? theme.fgAlt : theme.fg;
  const accent = theme.accent;
  // Scale typography off the *shorter* dimension so landscape layouts don't
  // produce headlines so tall they overlap the device frame.
  const unit = Math.min(cW, cH);
  const labelStyle = resolveLabelStyle(slide, unit, labelFont || DEFAULT_LABEL_FONT, accent, labelText);
  const headlineStyle = resolveHeadlineStyle(slide, unit, headlineFont || DEFAULT_HEADLINE_FONT, fg, headlineText);
  // RTL locales (ar-SA, he) read right-to-left: flip left alignment and set
  // bidi context so punctuation/numbers order correctly in preview + export.
  const rtl = isRtlLocale(locale);
  const effectiveAlign = align === "left" && rtl ? "right" : align;
  return (
    <div
      style={{ textAlign: effectiveAlign, position: "relative", width: "100%" }}
      dir={rtl ? "rtl" : undefined}
      lang={locale || undefined}
    >
      <EditableText
        value={pickText(slide.label, locale)}
        editable={editable}
        onChange={edit?.onLabelChange}
        onFocus={onFocus}
        placeholder="LABEL"
        label="Label"
        style={{
          fontSize: labelStyle.fontSize,
          fontWeight: labelStyle.fontWeight,
          letterSpacing: unit * 0.0015,
          color: labelStyle.color,
          textTransform: "uppercase",
          marginBottom: unit * 0.018,
          minHeight: unit * 0.03,
          fontFamily: fontStack(labelStyle.fontFamily),
        }}
      />
      <EditableText
        value={pickText(slide.headline, locale)}
        editable={editable}
        multiline
        onChange={edit?.onHeadlineChange}
        onFocus={onFocus}
        placeholder="Headline goes here"
        label="Headline"
        style={{
          fontSize: headlineStyle.fontSize,
          fontWeight: headlineStyle.fontWeight,
          lineHeight: 1.2,
          letterSpacing: -unit * 0.001,
          color: headlineStyle.color,
          fontFamily: fontStack(headlineStyle.fontFamily),
        }}
      />
    </div>
  );
}

// ---------- Background ----------

function backgroundFor(theme: Theme, inverted?: boolean) {
  if (inverted) {
    return `linear-gradient(160deg, ${theme.bgAlt} 0%, ${shade(theme.bgAlt, -8)} 100%)`;
  }
  return `linear-gradient(160deg, ${theme.bg} 0%, ${shade(theme.bg, -6)} 100%)`;
}

function shade(hex: string, percent: number) {
  const c = hex.replace("#", "");
  const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round((255 * percent) / 100);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ---------- Decorative blob ----------

function Blob({
  cW,
  color,
  x,
  y,
  size,
  opacity = 0.4,
}: {
  cW: number;
  color: string;
  x: number;
  y: number;
  size: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}%`,
        aspectRatio: "1 / 1",
        background: color,
        borderRadius: "50%",
        filter: `blur(${cW * 0.06}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

// ---------- Default element rects per layout ----------

type Rect = { x: number; y: number; width: number; height: number };

/** One cross-screen snap candidate: deck-global rect + owning slide. */
type SnapExtra = {
  slideId: string;
  id: ElementId;
  rect: SnapRect;
};

const EMPTY_SNAP_EXTRAS: SnapExtra[] = [];

function sameSnapExtras(a: SnapExtra[], b: SnapExtra[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (e, i) =>
      e.slideId === b[i].slideId &&
      e.id === b[i].id &&
      e.rect.x === b[i].rect.x &&
      e.rect.y === b[i].rect.y &&
      e.rect.width === b[i].rect.width &&
      e.rect.height === b[i].rect.height,
  );
}
type LayoutRects = {
  caption?: Rect & { align?: "center" | "left" };
  device?: Rect;
  deviceSecondary?: Rect;
};

function getDefaultRects(
  layout: Slide["layout"],
  cW: number,
  cH: number,
  frameAspect: number,
  fwFrac: number,
  fwSmallFrac: number,
): LayoutRects {
  const deviceW = fwFrac * cW;
  const deviceH = deviceW / frameAspect;
  const smallW = fwSmallFrac * cW;
  const smallH = smallW / frameAspect;
  const capW = cW * 0.84;
  const capH = cH * 0.28;

  switch (layout) {
    case "hero":
      return {
        caption: { x: cW * 0.08, y: cH * 0.09, width: capW, height: capH, align: "center" },
        device: {
          x: (cW - deviceW) / 2,
          y: cH - deviceH + deviceH * 0.15,
          width: deviceW,
          height: deviceH,
        },
      };
    case "device-bottom":
      return {
        caption: { x: cW * 0.08, y: cH * 0.08, width: capW, height: capH, align: "center" },
        device: {
          x: (cW - deviceW) / 2,
          y: cH - deviceH - cH * 0.02,
          width: deviceW,
          height: deviceH,
        },
      };
    case "device-top":
      return {
        caption: { x: cW * 0.08, y: cH * 0.65, width: capW, height: capH, align: "center" },
        device: {
          x: (cW - deviceW) / 2,
          y: -cH * 0.1,
          width: deviceW,
          height: deviceH,
        },
      };
    case "two-devices":
      return {
        caption: { x: cW * 0.08, y: cH * 0.08, width: capW, height: capH, align: "center" },
        deviceSecondary: {
          x: -cW * 0.06,
          y: cH - smallH - cH * 0.05,
          width: smallW,
          height: smallH,
        },
        device: {
          x: cW - deviceW * 0.9 + cW * 0.06,
          y: cH - deviceH * 0.9 - cH * 0.02,
          width: deviceW * 0.9,
          height: (deviceW * 0.9) / frameAspect,
        },
      };
    case "no-device":
      return {
        caption: {
          x: cW * 0.1,
          y: cH * 0.35,
          width: cW * 0.8,
          height: cH * 0.3,
          align: "center",
        },
      };
    default:
      return {};
  }
}

function rectFor(
  id: BuiltInElementId,
  slide: Slide,
  defaults: LayoutRects,
): (Rect & { align?: "center" | "left" }) | undefined {
  const saved = slide.transforms?.[id];
  const def = defaults[id];
  if (!def && !saved) return undefined;
  if (!saved) return def;
  return {
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    align: (def as { align?: "center" | "left" } | undefined)?.align,
  };
}

function getSlideGeometry(
  slide: Slide,
  device: Device,
  overrides?: Partial<Record<Device, CanvasSize>>,
) {
  const { cW, cH } = getCanvas(device, overrides);
  const { Comp: Frame, widthFn, smallWidthFn } = getFrameForDevice(device);
  const frameAspect = getFrameAspect(device);
  const fwFrac = widthFn(cW, cH);
  const fwSmallFrac = smallWidthFn(cW, cH);
  const defaults = getDefaultRects(slide.layout, cW, cH, frameAspect, fwFrac, fwSmallFrac);
  return { cW, cH, Frame, frameAspect, defaults };
}

export function getElementTransform(
  slide: Slide,
  device: Device,
  id: ElementId,
  overrides?: Partial<Record<Device, CanvasSize>>,
): ElementTransform | undefined {
  if (id.startsWith("text:")) {
    const textId = id.slice("text:".length);
    const textElement = slide.textElements?.find((element) => element.id === textId);
    return textElement?.transform;
  }
  const { defaults } = getSlideGeometry(slide, device, overrides);
  const rect = rectFor(id as BuiltInElementId, slide, defaults);
  if (!rect) return undefined;
  const saved = slide.transforms?.[id as BuiltInElementId];
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: saved?.rotation ?? 0,
    flipH: saved?.flipH ?? false,
    flipV: saved?.flipV ?? false,
    zIndex: saved?.zIndex ?? defaultElementZ(id as BuiltInElementId),
  };
}

function defaultElementZ(id: BuiltInElementId): number {
  if (id === "deviceSecondary") return 2;
  if (id === "device") return 3;
  return 4;
}

// ---------- Main single-screen canvas ----------

function SlideCanvasInner({
  slide,
  device,
  theme,
  locale,
  editable,
  edit,
  selectedElementId = null,
  previewScale = 1,
  hideEmpty,
  headlineFont,
  labelFont,
  background,
  frames,
  sizes,
  headlineText,
  labelText,
}: Props) {
  const { cW, cH } = getCanvas(device, sizes);

  const handleBackgroundMouseDown = editable
    ? (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) edit?.onSelectElement?.(null);
      }
    : undefined;

  return (
    <div
      onMouseDown={handleBackgroundMouseDown}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
            <SlideBackground slide={slide} background={slide.background ?? background} cW={cW} theme={theme} />
      <SlideElements
        slide={slide}
        device={device}
        theme={theme}
        locale={locale}
        editable={editable}
        edit={edit}
        selectedElementId={selectedElementId}
        previewScale={previewScale}
        hideEmpty={hideEmpty}
        headlineFont={headlineFont}
        labelFont={labelFont}
        screenX={0}
        boundsW={cW}
        boundsH={cH}
        allowCrossScreen={false}
        frames={frames}
        sizes={sizes}
        headlineText={headlineText}
        labelText={labelText}
      />
    </div>
  );
}

// Shallow compare is exact: slide identity is preserved for untouched slides
// and every other prop here is a scalar or stable reference.
export const SlideCanvas = React.memo(SlideCanvasInner);

// ---------- Connected deck canvas ----------

function areDeckPropsEqual(prev: DeckCanvasProps, next: DeckCanvasProps): boolean {
  if (prev.slides.length !== next.slides.length) return false;
  for (let i = 0; i < prev.slides.length; i++) {
    if (prev.slides[i] !== next.slides[i]) return false;
  }
  return (
    prev.device === next.device &&
    prev.theme === next.theme &&
    prev.locale === next.locale &&
    prev.connectedCanvas === next.connectedCanvas &&
    prev.editable === next.editable &&
    prev.edit === next.edit &&
    prev.selectedElement === next.selectedElement &&
    prev.selectedPeers === next.selectedPeers &&
    prev.activeSlideId === next.activeSlideId &&
    prev.previewScale === next.previewScale &&
    prev.hideEmpty === next.hideEmpty &&
    prev.showGuides === next.showGuides &&
    prev.headlineFont === next.headlineFont &&
    prev.labelFont === next.labelFont &&
    prev.background === next.background &&
    prev.frames === next.frames &&
    prev.sizes === next.sizes &&
    prev.headlineText === next.headlineText &&
    prev.labelText === next.labelText &&
    prev.guides === next.guides &&
    prev.snapEnabled === next.snapEnabled
  );
}

type MemoSlideProps = Omit<SlideElementsProps, "edit"> & {
  edit?: DeckEditHandlers;
  connectedCanvas: boolean;
  wrapLeft: number;
};

const MemoSlide = React.memo(
  function MemoSlide({
    connectedCanvas,
    wrapLeft,
    ...elementsProps
  }: MemoSlideProps) {
    const {
      slide,
      device,
      theme,
      locale,
      editable,
      edit,
      selectedElementId,
      previewScale,
      hideEmpty,
      headlineFont,
      labelFont,
      screenX,
      boundsW,
      boundsH,
      allowCrossScreen,
      frames,
      sizes,
      headlineText,
      labelText,
      guides,
      snapEnabled,
      onSnapPreview,
      selectedPeers,
      snapOrigins,
      snapExtras,
      snapFrameOrigin,
    } = elementsProps;
    const perSlideEdit: EditHandlers | undefined = React.useMemo(
      () =>
        editable
          ? {
              onLabelChange: (v) => edit?.onLabelChange?.(slide.id, v),
              onHeadlineChange: (v) => edit?.onHeadlineChange?.(slide.id, v),
              onTextElementTextChange: (id, v) =>
                edit?.onTextElementTextChange?.(slide.id, id, v),
              onElementChange: (id, t) => edit?.onElementChange?.(slide.id, id, t),
              onSelectElement: (id, additive) => {
                edit?.onSelectScreen?.(slide.id);
                edit?.onSelectElement?.(id ? { slideId: slide.id, elementId: id } : null, additive);
              },
            }
          : undefined,
      // slide.id is stable for the lifetime of this slide identity.
      [editable, edit, slide.id],
    );
    const elements = (
      <SlideElements
        slide={slide}
        device={device}
        theme={theme}
        locale={locale}
        editable={editable}
        edit={perSlideEdit}
        selectedElementId={selectedElementId}
        previewScale={previewScale}
        hideEmpty={hideEmpty}
        headlineFont={headlineFont}
        labelFont={labelFont}
        screenX={screenX}
        boundsW={boundsW}
        boundsH={boundsH}
        allowCrossScreen={allowCrossScreen}
        frames={frames}
        sizes={sizes}
        headlineText={headlineText}
        labelText={labelText}
        guides={guides}
        snapEnabled={snapEnabled}
        onSnapPreview={onSnapPreview}
        selectedPeers={selectedPeers}
        snapOrigins={snapOrigins}
        snapExtras={snapExtras}
        snapFrameOrigin={snapFrameOrigin}
      />
    );
    if (connectedCanvas) return elements;
    return (
      <div
        onMouseDown={(e) => {
          if (!editable) return;
          if (e.defaultPrevented) return;
          const target = e.target as HTMLElement | null;
          if (target && target.closest && target.closest(".rnd-editable, [contenteditable]")) {
            return;
          }
          edit?.onSelectScreen?.(slide.id);
          edit?.onSelectElement?.(null);
        }}
        style={{
          position: "absolute",
          left: wrapLeft,
          top: 0,
          width: boundsW,
          height: boundsH,
          overflow: "hidden",
        }}
      >
        {elements}
      </div>
    );
  },
  (prev, next) =>
    prev.slide === next.slide &&
    prev.device === next.device &&
    prev.theme === next.theme &&
    prev.locale === next.locale &&
    prev.editable === next.editable &&
    prev.edit === next.edit &&
    prev.selectedElementId === next.selectedElementId &&
    prev.previewScale === next.previewScale &&
    prev.hideEmpty === next.hideEmpty &&
    prev.headlineFont === next.headlineFont &&
    prev.labelFont === next.labelFont &&
    prev.screenX === next.screenX &&
    prev.boundsW === next.boundsW &&
    prev.boundsH === next.boundsH &&
    prev.allowCrossScreen === next.allowCrossScreen &&
    prev.connectedCanvas === next.connectedCanvas &&
    prev.wrapLeft === next.wrapLeft &&
    prev.frames === next.frames &&
    prev.sizes === next.sizes &&
    prev.headlineText === next.headlineText &&
    prev.labelText === next.labelText &&
    prev.guides === next.guides &&
    prev.snapEnabled === next.snapEnabled &&
    prev.onSnapPreview === next.onSnapPreview &&
    prev.selectedPeers === next.selectedPeers &&
    prev.snapOrigins === next.snapOrigins &&
    sameSnapExtras(prev.snapExtras || EMPTY_SNAP_EXTRAS, next.snapExtras || EMPTY_SNAP_EXTRAS) &&
    prev.snapFrameOrigin === next.snapFrameOrigin,
);

// Figma-style screen title above each frame: click selects, second click or
// double-click edits inline. Editing state is local so keystrokes never
// re-render the deck; commit goes through onRename on blur/Enter, Esc cancels.
function ScreenTitle({
  slide,
  index,
  screenX,
  maxWidth,
  titleSize,
  titleOffset,
  active,
  editable,
  onSelect,
  onRename,
}: {
  slide: Slide;
  index: number;
  screenX: number;
  maxWidth: number;
  titleSize: number;
  titleOffset: number;
  active: boolean;
  editable?: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const editRef = React.useRef<HTMLSpanElement | null>(null);
  const label = screenCanvasLabel(slide, index);

  // Focus + select-all when entering edit mode.
  React.useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.textContent = (slide.name ?? "").trim() || "Screen";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // Leave edit mode when the screen identity changes (deleted/switched).
  React.useEffect(() => {
    setEditing(false);
  }, [slide.id]);

  function commit() {
    const el = editRef.current;
    const next = (el?.textContent ?? "").replace(/\n/g, " ").trim().slice(0, 60);
    setEditing(false);
    if (next !== (slide.name ?? "").trim()) {
      onRename(next);
    }
  }

  function cancel() {
    setEditing(false);
  }

  if (editing) {
    return (
      <span
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={`Rename screen ${index + 1}`}
        spellCheck={false}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: screenX,
          top: -titleOffset,
          maxWidth,
          minWidth: 40,
          overflow: "hidden",
          whiteSpace: "nowrap",
          fontSize: titleSize,
          lineHeight: 1.2,
          fontWeight: 700,
          letterSpacing: 0,
          color: "#0D99FF",
          background: "rgba(13, 153, 255, 0.08)",
          borderRadius: 4,
          outline: "1.5px solid #0D99FF",
          cursor: "text",
          userSelect: "text",
        }}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={editable ? 0 : undefined}
      aria-label={`Select screen ${index + 1}: ${slide.name?.trim() || "Screen"}. Activate again to rename.`}
      onMouseDown={(e) => {
        if (!editable || e.defaultPrevented) return;
        e.preventDefault();
        if (!active) {
          onSelect();
        } else {
          setEditing(true);
        }
      }}
      onKeyDown={(e) => {
        if (!editable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!active) onSelect();
          else setEditing(true);
        }
      }}
      onDoubleClick={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onSelect();
        setEditing(true);
      }}
      title="Click to select, click again to rename"
      style={{
        position: "absolute",
        left: screenX,
        top: -titleOffset,
        maxWidth,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: titleSize,
        lineHeight: 1.2,
        fontWeight: active ? 700 : 600,
        letterSpacing: 0,
        color: active ? "#0D99FF" : "rgba(118, 118, 118, 0.95)",
        cursor: editable ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}

function DeckCanvasInner({
  slides,
  device,
  theme,
  locale,
  connectedCanvas = true,
  editable,
  edit,
  selectedElement = null,
  selectedPeers,
  activeSlideId = null,
  previewScale = 1,
  hideEmpty,
  showGuides = false,
  headlineFont,
  labelFont,
  background,
  frames,
  sizes,
  headlineText,
  labelText,
  gap = 0,
  guides,
  snapEnabled = true,
}: DeckCanvasProps) {
  const { cW, cH } = getCanvas(device, sizes);
  const stride = cW + gap;
  const totalW = Math.max(1, slides.length) * cW + Math.max(0, slides.length - 1) * gap;
  // Live snap indicator lines (Figma red). Owned here so every slide's drag
  // reports into one overlay; cleared on drop. Never rendered for export:
  // export callers don't pass guides and never drag.
  const [snapLines, setSnapLines] = React.useState<SnapLine[]>([]);
  const onSnapPreview = React.useCallback((lines: SnapLine[]) => {
    // Drag fires per mousemove — skip the render when the lines are unchanged.
    setSnapLines((prev) => (sameSnapLines(prev, lines) ? prev : lines));
  }, []);
  // Every screen origin in deck-global coords, so edges/centers snap per
  // screen on a connected deck. Memoized on count (not identity) so content
  // edits don't invalidate every slide's memo.
  const snapOrigins = React.useMemo(
    () => (connectedCanvas ? slides.map((_, i) => i * stride) : [0]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides.length, stride, connectedCanvas],
  );
  // Every element on every OTHER screen (deck-global), so a drag near a
  // screen boundary also snaps to neighbors Figma-style. Content-compared
  // (not identity) for the same memo reason — see sameSnapExtras.
  const snapExtras = React.useMemo(() => {
    if (!connectedCanvas) return EMPTY_SNAP_EXTRAS;
    const out: SnapExtra[] = [];
    slides.forEach((slide, index) => {
      const x0 = index * stride;
      const { defaults } = getSlideGeometry(slide, device, sizes);
      const push = (id: ElementId, rect: Rect | undefined) => {
        if (rect) {
          out.push({
            slideId: slide.id,
            id,
            rect: { x: rect.x + x0, y: rect.y, width: rect.width, height: rect.height },
          });
        }
      };
      push("caption", rectFor("caption", slide, defaults));
      push("device", rectFor("device", slide, defaults));
      push("deviceSecondary", rectFor("deviceSecondary", slide, defaults));
      for (const t of slide.textElements || []) push(toTextElementId(t.id), t.transform);
    });
    return out;
  }, [slides, device, sizes, connectedCanvas, stride]);
  // Editor titles float above each frame (Figma-style); export stays clipped.
  const titleSize = Math.max(24, cW * 0.022);
  const titleOffset = titleSize * 1.9;

  return (
    <div
      style={{
        width: totalW,
        height: cH,
        position: "relative",
        overflow: showGuides ? "visible" : "hidden",
      }}
    >
      {showGuides &&
        slides.map((slide, index) => (
          <ScreenTitle
            key={`${slide.id}-title`}
            slide={slide}
            index={index}
            screenX={index * stride}
            maxWidth={cW}
            titleSize={titleSize}
            titleOffset={titleOffset}
            active={activeSlideId === slide.id}
            editable={editable}
            onSelect={() => {
              edit?.onSelectScreen?.(slide.id);
              edit?.onSelectElement?.(null);
            }}
            onRename={(name) => edit?.onRenameScreen?.(slide.id, name)}
          />
        ))}
      {slides.map((slide, index) => {
        const screenX = index * stride;
        const active = activeSlideId === slide.id;
        return (
          <div
            key={`${slide.id}-bg`}
            onMouseDown={(e) => {
              if (!editable) return;
              // Only empty-canvas hits select the screen: element drags and
              // text edits mark the event handled so they keep element selection.
              if (e.defaultPrevented) return;
              const target = e.target as HTMLElement | null;
              if (target && target.closest && target.closest(".rnd-editable, [contenteditable]")) {
                return;
              }
              edit?.onSelectScreen?.(slide.id);
              edit?.onSelectElement?.(null);
            }}
            style={{
              position: "absolute",
              left: screenX,
              top: 0,
              width: cW,
              height: cH,
              overflow: "hidden",
            }}
          >
      <SlideBackground slide={slide} background={slide.background ?? background} cW={cW} theme={theme} />
            {showGuides && <ScreenGuide cW={cW} cH={cH} index={index} active={active} />}
          </div>
        );
      })}

      {slides.map((slide, index) => (
        <MemoSlide
          key={`${slide.id}-elements`}
          slide={slide}
          device={device}
          theme={theme}
          locale={locale}
          editable={editable}
          edit={edit}
          selectedElementId={
            selectedElement && selectedElement.slideId === slide.id
              ? selectedElement.elementId
              : null
          }
          selectedPeers={selectedPeers}
          previewScale={previewScale}
          hideEmpty={hideEmpty}
          headlineFont={headlineFont}
          labelFont={labelFont}
          screenX={connectedCanvas ? index * stride : 0}
          boundsW={connectedCanvas ? totalW : cW}
          boundsH={cH}
          allowCrossScreen={connectedCanvas}
          frames={frames}
          sizes={sizes}
          headlineText={headlineText}
          labelText={labelText}
          guides={guides}
          snapEnabled={snapEnabled}
          onSnapPreview={onSnapPreview}
          snapOrigins={snapOrigins}
          snapExtras={snapExtras}
          snapFrameOrigin={connectedCanvas ? 0 : index * stride}
          connectedCanvas={connectedCanvas}
          wrapLeft={index * stride}
        />
      ))}
      {/* Figma-style snap indicators: red lines across the deck. Editor
          chrome like guides — export uses DeckCanvas without dragging, so
          snapLines is always empty there. */}
      {snapLines.length > 0 ? (
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {snapLines.map((line, i) =>
            line.axis === "v" ? (
              <div
                key={`snap-v-${line.pos}-${i}`}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: line.pos,
                  width: 2,
                  background: "#FF3838",
                }}
              />
            ) : (
              <div
                key={`snap-h-${line.pos}-${i}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: line.pos,
                  height: 2,
                  background: "#FF3838",
                }}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

const SlideElements = React.memo(SlideElementsInner, areSlideElementsEqual);

export const DeckCanvas = React.memo(DeckCanvasInner, areDeckPropsEqual);

function SlideBackground({
  slide,
  background,
  cW,
  theme,
}: {
  slide: Slide;
  background?: ScreenBackground;
  cW: number;
  theme: Theme;
}) {
  const inverted = !!slide.inverted;
  const bg = background ?? slide.background ?? { kind: "theme" as const };
  const textColor = inverted ? theme.fgAlt : theme.fg;
  // Style tweaks shared by every kind. Blur gets a slight scale so softened
  // edges never show the screen bounds.
  const opacity = bg.opacity ?? 1;
  const blur = Math.max(0, bg.blur ?? 0);
  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    opacity,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    transform: blur > 0 ? "scale(1.06)" : undefined,
    color: textColor,
  };
  if (bg.kind === "image" && bg.src) {
    const src = img(bg.src);
    if (src) {
      return (
        <div style={{ ...layerStyle, background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
        </div>
      );
    }
    // Unresolvable image falls through to the theme background.
  }
  if (bg.kind === "mesh" && bg.colors.length >= 2) {
    return <div style={{ ...layerStyle, background: meshBackground(bg.colors, bg.angle) }} />;
  }
  return (
    <div style={{ ...layerStyle, background: backgroundFor(theme, inverted) }}>
      <Blob cW={cW} color={theme.accent} x={-15} y={-10} size={55} opacity={inverted ? 0.25 : 0.32} />
      <Blob cW={cW} color={theme.accent} x={70} y={75} size={45} opacity={inverted ? 0.18 : 0.25} />
    </div>
  );
}

// Layered radial gradients over a darkened base — the classic mesh look.
// Angle steers the base linear-gradient direction (degrees, default 160).
export function meshBackground(colors: string[], angle = 160): string {
  const [c0, c1 = c0, c2 = c0] = colors;
  const c3 = colors[3] ?? c1;
  const base = shade(c0, -14);
  return [
    `radial-gradient(at 12% 6%, ${c1} 0%, transparent 55%)`,
    `radial-gradient(at 88% 14%, ${c2} 0%, transparent 52%)`,
    `radial-gradient(at 50% 105%, ${c3} 0%, transparent 60%)`,
    `linear-gradient(${angle}deg, ${base} 0%, ${shade(base, -10)} 100%)`,
  ].join(", ");
}

function ScreenGuide({
  cW,
  cH,
  index,
  active,
}: {
  cW: number;
  cH: number;
  index: number;
  active: boolean;
}) {
  void index;
  void cH;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        outline: `${active ? Math.max(4, cW * 0.003) : Math.max(2, cW * 0.0015)}px solid ${
          active ? "#0D99FF" : "rgba(15, 23, 42, 0.22)"
        }`,
        outlineOffset: active ? -Math.max(4, cW * 0.003) : -Math.max(2, cW * 0.0015),
        boxShadow: active
          ? "inset 0 0 0 9999px rgba(13, 153, 255, 0.04)"
          : "inset 0 0 0 1px rgba(255, 255, 255, 0.22)",
      }}
    />
  );
}

// Full-bleed image for "static" screens. Non-interactive (pointer events
// pass through) so the screen itself stays selectable but exposes no
// movable elements.
function StaticImage({
  slide,
  locale,
  x,
  cW,
  cH,
  hideEmpty,
}: {
  slide: Slide;
  locale: string;
  x: number;
  cW: number;
  cH: number;
  hideEmpty?: boolean;
}) {
  const src = img(resolveScreenshot(slide.screenshot, locale));
  if (!src) {
    if (hideEmpty) return null;
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: cW,
          height: cH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: cW * 0.08,
          border: `${Math.max(3, cW * 0.004)}px dashed rgba(125, 135, 155, 0.65)`,
          color: "rgba(125, 135, 155, 0.9)",
          fontSize: Math.max(20, cW * 0.032),
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        Add a static image in the Inspector
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- canvas pixels, not LCP content
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: cW,
        height: cH,
        objectFit: "cover",
        pointerEvents: "none",
      }}
    />
  );
}

type SlideElementsProps = {
  slide: Slide;
  device: Device;
  theme: Theme;
  locale: string;
  editable?: boolean;
  edit?: EditHandlers;
  selectedElementId: ElementId | null;
  previewScale: number;
  hideEmpty?: boolean;
  headlineFont?: string;
  labelFont?: string;
  screenX: number;
  boundsW: number;
  boundsH: number;
  allowCrossScreen: boolean;
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  sizes?: Partial<Record<Device, CanvasSize>>;
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  guides?: Guide[];
  snapEnabled?: boolean;
  onSnapPreview?: (lines: SnapLine[]) => void;
  selectedPeers?: SelectedElement[];
  /** All screen origins in the drag frame (connected: every screen). */
  snapOrigins?: number[];
  /** Cross-screen rects, deck-global (connected only). Content-compared. */
  snapExtras?: SnapExtra[];
  /** Deck-global X of the drag frame origin (isolated: screen offset). */
  snapFrameOrigin?: number;
};

function areSlideElementsEqual(prev: SlideElementsProps, next: SlideElementsProps): boolean {
  // Slide identity is preserved for untouched slides by every mutation, so a
  // reference check isolates re-renders to the edited slide. All other props
  // are scalars or stable references by construction.
  return (
    prev.slide === next.slide &&
    prev.device === next.device &&
    prev.theme === next.theme &&
    prev.locale === next.locale &&
    prev.editable === next.editable &&
    prev.edit === next.edit &&
    prev.selectedElementId === next.selectedElementId &&
    prev.previewScale === next.previewScale &&
    prev.hideEmpty === next.hideEmpty &&
    prev.headlineFont === next.headlineFont &&
    prev.labelFont === next.labelFont &&
    prev.screenX === next.screenX &&
    prev.boundsW === next.boundsW &&
    prev.boundsH === next.boundsH &&
    prev.allowCrossScreen === next.allowCrossScreen &&
    prev.frames === next.frames &&
    prev.sizes === next.sizes &&
    prev.headlineText === next.headlineText &&
    prev.labelText === next.labelText &&
    prev.guides === next.guides &&
    prev.snapEnabled === next.snapEnabled &&
    prev.onSnapPreview === next.onSnapPreview &&
    prev.selectedPeers === next.selectedPeers &&
    prev.snapOrigins === next.snapOrigins &&
    sameSnapExtras(prev.snapExtras || EMPTY_SNAP_EXTRAS, next.snapExtras || EMPTY_SNAP_EXTRAS) &&
    prev.snapFrameOrigin === next.snapFrameOrigin
  );
}

function SlideElementsInner({
  slide,
  device,
  theme,
  locale,
  editable,
  edit,
  selectedElementId,
  previewScale,
  hideEmpty,
  headlineFont,
  labelFont,
  screenX,
  boundsW,
  boundsH,
  allowCrossScreen,
  frames,
  sizes,
  headlineText,
  labelText,
  guides,
  snapEnabled = true,
  onSnapPreview,
  selectedPeers,
  snapOrigins,
  snapExtras,
  snapFrameOrigin = 0,
}: SlideElementsProps) {
  // Gravity follows zoom: ~5 screen px at any zoom level.
  const snapThreshold = snapThresholdForScale(previewScale);
  // Indicator lines are reported deck-global (the overlay lives on the deck
  // root) while drag math runs in frame coords — shift vertical lines back.
  // Connected frames start at 0 (identity); isolated screens shift by offset.
  const reportSnap = onSnapPreview
    ? (lines: SnapLine[]) =>
        onSnapPreview(
          snapFrameOrigin
            ? lines.map((l) => (l.axis === "v" ? { ...l, pos: l.pos + snapFrameOrigin } : l))
            : lines,
        )
    : undefined;
  // Peer ids on this slide for multi-selection highlight. Stable inputs keep
  // the slide memo intact; the set itself is rebuilt per render (cheap).
  const peerIdSet = React.useMemo(() => {
    const set = new Set<ElementId>();
    for (const p of selectedPeers || []) {
      if (p.slideId === slide.id) set.add(p.elementId);
    }
    return set;
  }, [selectedPeers, slide.id]);
  const screenshot = resolveScreenshot(slide.screenshot, locale);
  const screenshotSecondary = resolveScreenshot(slide.screenshotSecondary, locale);
  const { cW, cH, Frame, frameAspect, defaults } = getSlideGeometry(slide, device, sizes);
  const finish: FrameFinish | undefined =
    device === "phone" || device === "tablet" ? frames?.[device] : undefined;
  const inverted = !!slide.inverted;
  // Static screens render one full-bleed image plus any overlay text
  // elements — no frames or caption. Branching here covers SlideCanvas,
  // DeckCanvas (preview + export), and thumbnails in one place.
  if (slide.layout === "static") {
    return (
      <>
        <StaticImage
          slide={slide}
          locale={locale}
          x={screenX}
          cW={cW}
          cH={cH}
          hideEmpty={hideEmpty}
        />
        {(slide.textElements || []).map(renderTextElement)}
      </>
    );
  }
  const captionRect = rectFor("caption", slide, defaults);
  const deviceRect = rectFor("device", slide, defaults);
  const secondaryRect = rectFor("deviceSecondary", slide, defaults);

  function toGlobal(rect: Rect): Rect {
    return { ...rect, x: rect.x + screenX };
  }

  function toLocal(t: ElementTransform): ElementTransform {
    return { ...t, x: t.x - screenX };
  }

  // Deck-global rects of every element on this slide, so each dragged
  // element can snap to its siblings (Figma smart guides). Built lazily per
  // render; slides memoize on identity so untouched screens skip the work.
  function siblingRects(): { id: ElementId; rect: Rect }[] {
    const out: { id: ElementId; rect: Rect }[] = [];
    const captionRect = rectFor("caption", slide, defaults);
    const deviceRect = rectFor("device", slide, defaults);
    const secondaryRect = rectFor("deviceSecondary", slide, defaults);
    if (captionRect) out.push({ id: "caption", rect: toGlobal(captionRect) });
    if (deviceRect) out.push({ id: "device", rect: toGlobal(deviceRect) });
    if (secondaryRect) out.push({ id: "deviceSecondary", rect: toGlobal(secondaryRect) });
    for (const t of slide.textElements || []) {
      out.push({ id: toTextElementId(t.id), rect: toGlobal(t.transform) });
    }
    return out;
  }

  function snapTargetsFor(id: ElementId): { v: SnapLine[]; h: SnapLine[] } {
    // Own-screen siblings are already in frame coords. Deck-global extras
    // (other screens) and vertical guides shift into the frame; horizontal
    // guides are frame-independent (all screens share Y).
    const own = siblingRects()
      .filter((s) => s.id !== id)
      .map((s) => s.rect);
    const foreign = (snapExtras || [])
      .filter((s) => s.slideId !== slide.id)
      .map((s) => ({
        x: s.rect.x - snapFrameOrigin,
        y: s.rect.y,
        width: s.rect.width,
        height: s.rect.height,
      }));
    return buildSnapTargets({
      screenOrigins: snapOrigins || [screenX],
      cW,
      cH,
      others: [...own, ...foreign],
      guides: (guides || []).map((g) => ({
        axis: g.axis,
        pos: g.axis === "v" ? g.pos - snapFrameOrigin : g.pos,
      })),
    });
  }

  function renderCaption() {
    if (!captionRect) return null;
    const saved = slide.transforms?.caption;
    const rotation = saved?.rotation ?? 0;
    const flipH = saved?.flipH ?? false;
    const flipV = saved?.flipV ?? false;
    const zIndex = saved?.zIndex ?? 4;
    const inner = (
      <Caption
        cW={cW}
        cH={cH}
        slide={slide}
        theme={theme}
        locale={locale}
        editable={editable}
        edit={edit}
        align={captionRect.align || "center"}
        inverted={inverted}
        headlineFont={headlineFont}
        labelFont={labelFont}
        headlineText={headlineText}
        labelText={labelText}
        onFocus={() => edit?.onSelectElement?.("caption")}
      />
    );
    return (
      <Movable
        rect={toGlobal(captionRect)}
        boundsW={boundsW}
        boundsH={boundsH}
        editable={editable}
        previewScale={previewScale}
        snapTargets={reportSnap ? snapTargetsFor("caption") : undefined}
        snapEnabled={snapEnabled}
        snapThreshold={snapThreshold}
        onSnapPreview={reportSnap}
        rotation={rotation}
        flipH={flipH}
        flipV={flipV}
        onChange={(t) =>
          edit?.onElementChange?.(
            "caption",
            toLocal({
              ...t,
              rotation: t.rotation ?? rotation,
              flipH: t.flipH ?? flipH,
              flipV: t.flipV ?? flipV,
              zIndex: t.zIndex ?? zIndex,
            }),
          )
        }
        zIndex={zIndex}
        selected={selectedElementId === "caption" || peerIdSet.has("caption")}
        onSelect={(additive) => edit?.onSelectElement?.("caption", additive)}
        allowOverflow={allowCrossScreen}
        label="Headline"
      >
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "flex-start" }}>
          {inner}
        </div>
      </Movable>
    );
  }

  function renderDevice(id: "device" | "deviceSecondary", rect: Rect, src: string, extraStyle?: React.CSSProperties) {
    const saved = slide.transforms?.[id];
    const rotation = saved?.rotation ?? 0;
    const flipH = saved?.flipH ?? false;
    const flipV = saved?.flipV ?? false;
    const zIndex = saved?.zIndex ?? (id === "deviceSecondary" ? 2 : 3);
    return (
      <Movable
        rect={toGlobal(rect)}
        boundsW={boundsW}
        boundsH={boundsH}
        editable={editable}
        previewScale={previewScale}
        snapTargets={reportSnap ? snapTargetsFor(id) : undefined}
        snapEnabled={snapEnabled}
        snapThreshold={snapThreshold}
        onSnapPreview={reportSnap}
        rotation={rotation}
        flipH={flipH}
        flipV={flipV}
        onChange={(t) =>
          edit?.onElementChange?.(
            id,
            toLocal({
              ...t,
              rotation: t.rotation ?? rotation,
              flipH: t.flipH ?? flipH,
              flipV: t.flipV ?? flipV,
              zIndex: t.zIndex ?? zIndex,
            }),
          )
        }
        lockAspectRatio={frameAspect}
        zIndex={zIndex}
        allowOverflow
        selected={selectedElementId === id || peerIdSet.has(id)}
        onSelect={(additive) => edit?.onSelectElement?.(id, additive)}
        label={id === "deviceSecondary" ? "Back device" : "Device"}
      >
        <Frame
          src={src}
          hideEmpty={hideEmpty}
          finish={finish}
          style={{ width: "100%", height: "100%", ...extraStyle }}
        />
      </Movable>
    );
  }

  function renderTextElement(textElement: TextElement, index: number) {
    const elementId = toTextElementId(textElement.id);
    const rect = textElement.transform;
    const rotation = rect.rotation ?? 0;
    const flipH = rect.flipH ?? false;
    const flipV = rect.flipV ?? false;
    const zIndex = rect.zIndex ?? 5 + index;
    const textColor = textElement.color || (inverted ? theme.fgAlt : theme.fg);
    // Unset alignment follows the locale direction: right for RTL.
    const rtl = isRtlLocale(locale);
    const effectiveAlign = textElement.align ?? (rtl ? "right" : "center");
    return (
      <Movable
        key={textElement.id}
        rect={toGlobal(rect)}
        boundsW={boundsW}
        boundsH={boundsH}
        editable={editable}
        previewScale={previewScale}
        snapTargets={reportSnap ? snapTargetsFor(elementId) : undefined}
        snapEnabled={snapEnabled}
        snapThreshold={snapThreshold}
        onSnapPreview={reportSnap}
        rotation={rotation}
        flipH={flipH}
        flipV={flipV}
        onChange={(t) =>
          edit?.onElementChange?.(
            elementId,
            toLocal({
              ...t,
              rotation: t.rotation ?? rotation,
              flipH: t.flipH ?? flipH,
              flipV: t.flipV ?? flipV,
              zIndex: t.zIndex ?? zIndex,
            }),
          )
        }
        zIndex={zIndex}
        selected={selectedElementId === elementId || peerIdSet.has(elementId)}
        onSelect={(additive) => edit?.onSelectElement?.(elementId, additive)}
        allowOverflow={allowCrossScreen}
        label={`Overlay text ${index + 1}`}
      >
        <div
          dir={rtl ? "rtl" : undefined}
          lang={locale || undefined}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent:
              effectiveAlign === "right"
                ? "flex-end"
                : effectiveAlign === "left"
                  ? "flex-start"
                  : "center",
            padding: `${Math.min(cW, cH) * 0.012}px`,
          }}
        >
          <EditableText
            value={pickText(textElement.text, locale)}
            editable={editable}
            multiline
            onChange={(value) => edit?.onTextElementTextChange?.(textElement.id, value)}
            onFocus={() => edit?.onSelectElement?.(elementId)}
            placeholder="Text"
            label={`Overlay text ${index + 1}`}
            style={{
              width: "100%",
              color: textColor,
              fontSize: textElement.fontSize ?? Math.min(cW, cH) * 0.06,
              fontWeight: textElement.fontWeight ?? 700,
              lineHeight: 1.05,
              textAlign: effectiveAlign,
              textShadow: inverted ? "0 2px 18px rgba(0,0,0,0.22)" : "0 2px 18px rgba(255,255,255,0.2)",
              fontFamily: fontStack(textElement.fontFamily || labelFont || DEFAULT_LABEL_FONT),
            }}
          />
        </div>
      </Movable>
    );
  }

  return (
    <>
      {secondaryRect &&
        renderDevice(
          "deviceSecondary",
          secondaryRect,
          screenshotSecondary || screenshot,
          { opacity: 0.85 },
        )}
      {deviceRect && renderDevice("device", deviceRect, screenshot)}
      {renderCaption()}
      {(slide.textElements || []).map(renderTextElement)}
    </>
  );
}

// ---------- Movable wrapper ----------

// Fraction of an element's width/height that must remain inside the canvas
// when overflow is allowed. Keeps a graspable handle visible so the user can
// always drag the element back onto the canvas.
const MIN_VISIBLE_FRAC = 0.1;

function clampRect(
  r: { x: number; y: number; width: number; height: number },
  boundsW: number,
  boundsH: number,
  allowOverflow = false,
) {
  if (allowOverflow) {
    const width = r.width;
    const height = r.height;
    const minVisX = Math.max(8, width * MIN_VISIBLE_FRAC);
    const minVisY = Math.max(8, height * MIN_VISIBLE_FRAC);
    const x = Math.max(-(width - minVisX), Math.min(r.x, boundsW - minVisX));
    const y = Math.max(-(height - minVisY), Math.min(r.y, boundsH - minVisY));
    return { x, y, width, height };
  }
  const width = Math.min(r.width, boundsW);
  const height = Math.min(r.height, boundsH);
  const x = Math.max(0, Math.min(r.x, boundsW - width));
  const y = Math.max(0, Math.min(r.y, boundsH - height));
  return { x, y, width, height };
}

function Movable({
  rect,
  boundsW,
  boundsH,
  editable,
  previewScale,
  onChange,
  children,
  lockAspectRatio,
  zIndex,
  rotation = 0,
  flipH = false,
  flipV = false,
  allowOverflow = false,
  selected = false,
  onSelect,
  label,
  snapTargets,
  snapEnabled = true,
  snapThreshold = SNAP_THRESHOLD,
  onSnapPreview,
}: {
  rect: Rect;
  boundsW: number;
  boundsH: number;
  editable?: boolean;
  previewScale: number;
  onChange: (t: ElementTransform) => void;
  children: React.ReactNode;
  lockAspectRatio?: number | boolean;
  zIndex?: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  allowOverflow?: boolean;
  selected?: boolean;
  /** additive = Shift-click toggles a multi-selection peer. */
  onSelect?: (additive?: boolean) => void;
  label?: string;
  snapTargets?: { v: SnapLine[]; h: SnapLine[] };
  snapEnabled?: boolean;
  /** Gravity in canvas px — scaled to ~5 screen px by the caller. */
  snapThreshold?: number;
  onSnapPreview?: (lines: SnapLine[]) => void;
}) {
  const rotationRef = React.useRef(rotation);
  React.useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);
  // Mirror + rotation share one transform so preview, thumbs, and export
  // render identically (both paths use `rotated` below).
  const mirror = `${flipH ? "scaleX(-1)" : ""}${flipH && flipV ? " " : ""}${flipV ? "scaleY(-1)" : ""}`;
  const spin = rotation ? `rotate(${rotation}deg)` : "";
  const flipTransform = `${spin}${spin && mirror ? " " : ""}${mirror}` || undefined;

  function startRotate(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();

    const root = e.currentTarget.closest(".rnd-editable") as HTMLElement | null;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const startAngle = pointerAngle(e.clientX, e.clientY, centerX, centerY);
    const startRotation = rotationRef.current;

    const handleMove = (event: PointerEvent) => {
      event.preventDefault();
      let nextRotation = normalizeRotation(
        startRotation + pointerAngle(event.clientX, event.clientY, centerX, centerY) - startAngle,
      );
      // Figma parity: Shift snaps canvas rotation to 15° increments.
      if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
      rotationRef.current = nextRotation;
      onChange({
        x: display.x,
        y: display.y,
        width: display.width,
        height: display.height,
        rotation: nextRotation,
        flipH,
        flipV,
        zIndex,
      });
    };
    const stopRotate = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopRotate);
      window.removeEventListener("pointercancel", stopRotate);
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", stopRotate, { once: true });
    window.addEventListener("pointercancel", stopRotate, { once: true });
  }

  // Rotation lives on the inner wrapper so the Rnd's axis-aligned rect remains
  // the authoritative bounding box for drag/resize math. A bare mousedown
  // listener (no stopPropagation — that would prevent react-rnd from starting
  // a drag) marks the element as the current selection.
  // Keyboard path: the wrapper is focusable when editable; arrows nudge the
  // element (Shift = larger step) so positioning never requires a mouse.
  const nudge = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    const step = e.shiftKey ? 64 : 8;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
    const cur = clampRect(rect, boundsW, boundsH, allowOverflow);
    const next = clampRect(
      { x: cur.x + dx, y: cur.y + dy, width: cur.width, height: cur.height },
      boundsW,
      boundsH,
      allowOverflow,
    );
    onChange({ ...next, rotation, flipH, flipV, zIndex });
  };
  const rotated = (
    <div
      onMouseDown={(e) => {
        // Shift-click toggles a multi-selection peer (Figma).
        if (editable) onSelect?.(e.shiftKey);
      }}
      onFocus={() => {
        if (editable) onSelect?.(false);
      }}
      onKeyDown={nudge}
      tabIndex={editable ? 0 : undefined}
      role={editable ? "button" : undefined}
      aria-label={editable && label ? `${label}. Arrow keys move, Shift jumps.` : undefined}
      style={{
        width: "100%",
        height: "100%",
        transform: flipTransform,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );

  // Non-editable (export/thumb) path: plain absolute-positioned div, no Rnd.
  if (!editable) {
    return (
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          zIndex,
        }}
      >
        {rotated}
      </div>
    );
  }

  const display = clampRect(rect, boundsW, boundsH, allowOverflow);
  const controlScale = Math.max(0.05, previewScale);

  return (
    <Rnd
      bounds={allowOverflow ? undefined : "parent"}
      scale={previewScale}
      lockAspectRatio={lockAspectRatio}
      position={{ x: display.x, y: display.y }}
      size={{ width: display.width, height: display.height }}
      onDragStart={(e) => onSelect?.(dragShift(e))}
      onResizeStart={(e) => onSelect?.(dragShift(e))}
      onDrag={(e, d) => {
        // Live Figma-style snap indicator; the snap itself applies on release.
        if (!snapTargets || !onSnapPreview) return;
        if (snapSuspended(e, snapEnabled)) {
          onSnapPreview([]);
          return;
        }
        const preview = snapDrag(
          { x: d.x, y: d.y, width: display.width, height: display.height },
          snapTargets.v,
          snapTargets.h,
          snapThreshold,
        );
        onSnapPreview(preview.lines);
      }}
      onDragStop={(e, d) => {
        let origin = { x: d.x, y: d.y };
        if (snapTargets && !snapSuspended(e, snapEnabled)) {
          const snapped = snapDrag(
            { x: d.x, y: d.y, width: display.width, height: display.height },
            snapTargets.v,
            snapTargets.h,
            snapThreshold,
          );
          origin = { x: snapped.x, y: snapped.y };
        }
        onSnapPreview?.([]);
        const next = clampRect(
          { x: origin.x, y: origin.y, width: display.width, height: display.height },
          boundsW,
          boundsH,
          allowOverflow,
        );
        onChange({ ...next, rotation, flipH, flipV, zIndex });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onSnapPreview?.([]);
        const next = clampRect(
          {
            x: position.x,
            y: position.y,
            width: parseFloat(ref.style.width),
            height: parseFloat(ref.style.height),
          },
          boundsW,
          boundsH,
          allowOverflow,
        );
        onChange({ ...next, rotation, flipH, flipV, zIndex });
      }}
      style={{ zIndex }}
      resizeHandleStyles={handleStyle}
      className={selected ? "rnd-editable rnd-selected" : "rnd-editable"}
    >
      {rotated}
      <button
        type="button"
        className="rnd-rotate-handle"
        style={{
          right: -14 / controlScale,
          top: -14 / controlScale,
          width: 28 / controlScale,
          height: 28 / controlScale,
        }}
        onPointerDown={startRotate}
        title="Rotate"
        aria-label="Rotate element"
      >
        <RotateCw style={{ width: 14 / controlScale, height: 14 / controlScale }} />
      </button>
    </Rnd>
  );
}

function sameSnapLines(a: SnapLine[], b: SnapLine[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (line, i) =>
      line.axis === b[i].axis && line.pos === b[i].pos && line.source === b[i].source,
  );
}

// Shift held on a drag/resize gesture preserves additive (Shift-click)
// selection instead of collapsing it back to a single element.
function dragShift(e: unknown): boolean {
  return (e as { shiftKey?: boolean } | null | undefined)?.shiftKey === true;
}

// Figma parity: holding Control suspends snapping; the toggle disables it.
function snapSuspended(e: unknown, snapEnabled: boolean): boolean {
  if (!snapEnabled) return true;
  return (e as { ctrlKey?: boolean } | null | undefined)?.ctrlKey === true;
}

function pointerAngle(x: number, y: number, centerX: number, centerY: number) {
  return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
}

function normalizeRotation(degrees: number) {
  let next = degrees;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return Math.round(next);
}

// Subtle resize handles (visible only on hover via globals.css).
const handleSize = 14;
const handleStyle: Record<string, React.CSSProperties> = {
  top: { height: handleSize },
  right: { width: handleSize },
  bottom: { height: handleSize },
  left: { width: handleSize },
  topRight: { width: handleSize, height: handleSize },
  bottomRight: { width: handleSize, height: handleSize },
  bottomLeft: { width: handleSize, height: handleSize },
  topLeft: { width: handleSize, height: handleSize },
};
