"use client";
import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Languages,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { activeProvider, useAppSettings } from "@/lib/app-settings";
import { LAYOUT_HINT, LAYOUT_LABEL } from "@/lib/constants";
import { nid } from "@/lib/defaults";
import {
  isBuiltInElementId,
  isTextElementId,
  textElementKey,
  toTextElementId,
} from "@/lib/elements";
import { DEFAULT_LOCALE, pickText, writeLocalized } from "@/lib/locale";
import {
  applyLocaleTranslations,
  translateSlidesForLocale,
  findSourceSkips,
  TranslateError,
} from "@/lib/translate";
import type {
  BuiltInElementId,
  Device,
  ElementId,
  ElementTransform,
  Slide,
  SlideLayout,
  TextElement,
} from "@/lib/types";
import { ScreenshotPicker } from "./screenshot-picker";
import { BackgroundEditor } from "./background-controls";
import { getCanvas, getElementTransform } from "./slide-canvas";

type Props = {
  slide: Slide;
  device: Device;
  locale: string;
  locales: string[];
  selectedElementId: ElementId | null;
  disabled?: boolean;
  onExportSlide?: () => void;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
};

const ELEMENT_LABEL: Record<BuiltInElementId, string> = {
  caption: "Headline",
  device: "Device",
  deviceSecondary: "Back device",
};

export function Inspector({
  slide,
  device,
  locale,
  locales,
  selectedElementId,
  disabled,
  onExportSlide,
  onChange,
  onSelectElement,
}: Props) {
  const isNoDevice = slide.layout === "no-device";
  const isStatic = slide.layout === "static";
  const layoutValue = slide.layout;
  const layoutOptions = Object.entries(LAYOUT_LABEL);
  const localeLabel = slide.label?.[locale] ?? "";
  const localeHeadline = slide.headline?.[locale] ?? "";
  // When the active locale is empty, surface the fallback (typically en) as
  // the placeholder so the user sees what they're translating from.
  const headlineDefault = "One idea\nper slide.";
  const labelPlaceholder = localeLabel ? "FEATURE 01" : pickText(slide.label, locale) || "FEATURE 01";
  const headlinePlaceholder = localeHeadline
    ? headlineDefault
    : pickText(slide.headline, locale) || headlineDefault;

  function setLocaleField(key: "label" | "headline", value: string) {
    onChange({ [key]: writeLocalized(slide[key], locale, value) } as Partial<Slide>);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Screen settings</h2>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
              <span>editing</span>
              <span>·</span>
              <span className="font-medium text-foreground">{locale.toUpperCase()}</span>
            </div>
          </div>
          {onExportSlide && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1.5 px-2.5 text-xs font-medium"
              onClick={onExportSlide}
              disabled={disabled}
              title={`Export only this screen (${locale.toUpperCase()})`}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{LAYOUT_HINT[layoutValue]}</p>
      </div>

      <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-3 pt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
            <TabsTrigger value="design" className="text-xs">Design</TabsTrigger>
            <TabsTrigger value="arrange" className="text-xs">Arrange</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <TabsContent value="content" className="mt-0 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="screen-layout">
                Layout
              </Label>
              <Select
                value={layoutValue}
                onValueChange={(layout) => {
                  const next = layout as SlideLayout;
                  onChange({
                    layout: next,
                    transforms: undefined,
                    screenshotSecondary:
                      next === "two-devices" ? slide.screenshotSecondary || slide.screenshot : undefined,
                  });
                }}
              >
                <SelectTrigger id="screen-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {layoutOptions.map(([layout, label]) => (
                    <SelectItem key={layout} value={layout}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isStatic && (
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="screen-label">
                  Label
                </Label>
                <Input
                  id="screen-label"
                  value={localeLabel}
                  dir="auto"
                  onChange={(e) => setLocaleField("label", e.target.value)}
                  placeholder={labelPlaceholder}
                />
              </div>
            )}

            {!isStatic && (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label className="text-xs" htmlFor="screen-headline">
                    Headline
                  </Label>
                  <span className="text-[10px] text-muted-foreground">newline = break</span>
                </div>
                <Textarea
                  id="screen-headline"
                  value={localeHeadline}
                  dir="auto"
                  onChange={(e) => setLocaleField("headline", e.target.value)}
                  rows={3}
                  placeholder={headlinePlaceholder}
                />
              </div>
            )}

            {!isNoDevice && (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {isStatic
                    ? "Static image"
                    : slide.layout === "two-devices"
                      ? "Front device screenshot"
                      : "Screenshot"}
                </Label>
                <ScreenshotPicker
                  label="Primary"
                  value={slide.screenshot}
                  locale={locale}
                  onChange={(v) => onChange({ screenshot: v })}
                />
              </div>
            )}

            {slide.layout === "two-devices" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Back device screenshot</Label>
                <ScreenshotPicker
                  label="Secondary (back layer)"
                  value={slide.screenshotSecondary || ""}
                  locale={locale}
                  onChange={(v) => onChange({ screenshotSecondary: v })}
                />
              </div>
            )}

            {locales.length > 1 && (
              <ScreenTranslate
                slide={slide}
                locale={locale}
                disabled={disabled}
                onChange={onChange}
              />
            )}
          </TabsContent>
          <TabsContent value="design" className="mt-0 space-y-4">
            <BackgroundEditor
              value={slide.background}
              showDefault
              onChange={(background) => onChange({ background })}
            />
          </TabsContent>
          <TabsContent value="arrange" className="mt-0 space-y-4">
            <ElementTransformControls
              slide={slide}
              device={device}
              locale={locale}
              selectedElementId={selectedElementId}
              textOnly={isStatic}
              onChange={onChange}
              onSelectElement={onSelectElement}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// One-tap translate for the right sidebar: translates this screen from en to
// the current editing locale. No options — always overwrites the target.
// Static screens contribute their overlay texts (they carry no label/headline).
function ScreenTranslate({
  slide,
  locale,
  disabled,
  onChange,
}: {
  slide: Slide;
  locale: string;
  disabled?: boolean;
  onChange: (patch: Partial<Slide>) => void;
}) {
  const { settings } = useAppSettings();
  const provider = activeProvider(settings);
  const source = DEFAULT_LOCALE;
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState<
    { kind: "done"; count: number; skipped: number } | { kind: "error"; error: string } | null
  >(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Nothing to do when editing the source locale itself.
  if (locale === source) return null;

  async function run() {
    if (running) return;
    // Pin target locale + screen id: a locale/screen switch mid-run must not
    // write this screen's translations into another screen or locale.
    const targetLocale = locale;
    const runSlideId = slide.id;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setStatus(null);
    try {
      const results = await translateSlidesForLocale(
        { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: settings.model },
        [slide],
        source,
        targetLocale,
        { overwrite: true, signal: controller.signal },
      );
      if (slide.id !== runSlideId) {
        setStatus({
          kind: "error",
          error: "Screen changed during translation — result discarded",
        });
        return;
      }
      const next = applyLocaleTranslations([slide], results, targetLocale, true)[0];
      onChange({ label: next.label, headline: next.headline, textElements: next.textElements });
      const count = Object.values(results).reduce(
        (n, r) =>
          n +
          (r.label !== undefined ? 1 : 0) +
          (r.headline !== undefined ? 1 : 0) +
          Object.keys(r.texts || {}).length,
        0,
      );
      setStatus({ kind: "done", count, skipped: findSourceSkips([slide], source).length });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setStatus({
          kind: "error",
          error: e instanceof TranslateError ? e.message : String(e),
        });
      }
    } finally {
      setRunning(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <div className="space-y-1.5">
      {!provider.apiKey ? (
        <p className="text-[11px] text-muted-foreground">
          Add your OpenRouter API key in Settings → Providers (then Test) to enable
          translation.
        </p>
      ) : (
        <Button
          type="button"
          size="sm"
          className="h-7 w-full gap-1 text-xs"
          disabled={disabled || running}
          onClick={() => void run()}
          title={`Translate this screen from en to ${locale}`}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" />
          )}
          {running ? "Translating…" : "Translate screen"}
        </Button>
      )}
      {status?.kind === "done" && (
        <p
          role="status"
          className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400"
          title={`${status.count} strings translated — undo with Ctrl+Z${
            status.skipped > 0 ? ` (${status.skipped} skipped: no en source)` : ""
          }`}
        >
          <Check className="h-3.5 w-3.5 shrink-0" aria-label="Translated" />
          <span className="tabular-nums">{status.count}</span>
          {status.skipped > 0 && (
            <span className="text-muted-foreground">+{status.skipped} skipped</span>
          )}
        </p>
      )}
      {status?.kind === "error" && (
        <p role="status" className="flex items-center gap-1 text-[11px] text-destructive" title={status.error}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-label="Translation failed" />
          <span className="min-w-0 flex-1 truncate">{status.error}</span>
        </p>
      )}
    </div>
  );
}

function ElementTransformControls({
  slide,
  device,
  locale,
  selectedElementId,
  textOnly,
  onChange,
  onSelectElement,
}: {
  slide: Slide;
  device: Device;
  locale: string;
  selectedElementId: ElementId | null;
  // Static screens expose overlay texts only — no caption/device rows.
  textOnly?: boolean;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
}) {
  const present: ElementId[] = textOnly
    ? []
    : (["caption"] as ElementId[]);
  if (!textOnly && slide.layout !== "no-device") present.push("device");
  if (!textOnly && slide.layout === "two-devices") present.push("deviceSecondary");
  for (const element of slide.textElements || []) present.push(toTextElementId(element.id));

  const transforms = slide.transforms || {};
  const activeId =
    selectedElementId && present.includes(selectedElementId) ? selectedElementId : null;
  const activeTransform = activeId
    ? getElementTransform(slide, device, activeId)
    : undefined;
  const activeTextElement =
    activeId && isTextElementId(activeId)
      ? slide.textElements?.find((element) => element.id === textElementKey(activeId))
      : null;

  function getTransform(id: ElementId) {
    return getElementTransform(slide, device, id);
  }

  function patchElement(id: ElementId, patch: Partial<ElementTransform>) {
    const cur = getTransform(id);
    if (!cur) return;
    if (isTextElementId(id)) {
      const textId = textElementKey(id);
      onChange({
        textElements: (slide.textElements || []).map((element) =>
          element.id === textId
            ? { ...element, transform: { ...element.transform, ...patch } }
            : element,
        ),
      });
      return;
    }
    if (!isBuiltInElementId(id)) return;
    onChange({
      transforms: { ...transforms, [id]: { ...cur, ...patch } },
    });
  }

  function patchTextElement(id: string, patch: Partial<TextElement>) {
    onChange({
      textElements: (slide.textElements || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    });
  }

  function setTextElementValue(element: TextElement, value: string) {
    patchTextElement(element.id, { text: writeLocalized(element.text, locale, value) });
  }

  function deleteTextElement(element: TextElement) {
    const nextTextElements = (slide.textElements || []).filter((item) => item.id !== element.id);
    onChange({
      textElements: nextTextElements.length > 0 ? nextTextElements : undefined,
    });
    onSelectElement(null);
  }

  function addTextElement() {
    const { cW, cH } = getCanvas(device);
    const id = nid();
    const zIndex =
      Math.max(
        5,
        ...present.map((elementId) => getTransform(elementId)?.zIndex ?? defaultZ(elementId)),
      ) + 1;
    const element: TextElement = {
      id,
      text: writeLocalized({}, locale, "New text"),
      transform: {
        x: cW * 0.18,
        y: cH * 0.42,
        width: cW * 0.64,
        height: cH * 0.12,
        rotation: 0,
        zIndex,
      },
      fontSize: Math.round(Math.min(cW, cH) * 0.065),
      fontWeight: 800,
      align: "center",
    };
    onChange({ textElements: [...(slide.textElements || []), element] });
    onSelectElement(toTextElementId(id));
  }

  // Z-order: re-rank zIndex among present elements so they remain contiguous.
  function reorder(id: ElementId, dir: "front" | "back" | "up" | "down") {
    const ranked = [...present].sort((a, b) => {
      const za = getTransform(a)?.zIndex ?? defaultZ(a);
      const zb = getTransform(b)?.zIndex ?? defaultZ(b);
      return za - zb;
    });
    const idx = ranked.indexOf(id);
    if (idx === -1) return;
    let target = idx;
    if (dir === "front") target = ranked.length - 1;
    else if (dir === "back") target = 0;
    else if (dir === "up") target = Math.min(ranked.length - 1, idx + 1);
    else if (dir === "down") target = Math.max(0, idx - 1);
    if (target === idx) return;
    ranked.splice(idx, 1);
    ranked.splice(target, 0, id);
    const nextTransforms = { ...transforms };
    const nextTextElements = (slide.textElements || []).map((element) => ({
      ...element,
      transform: { ...element.transform },
    }));
    ranked.forEach((eid, i) => {
      const cur = getTransform(eid);
      if (!cur) return;
      if (isTextElementId(eid)) {
        const textId = textElementKey(eid);
        const textElement = nextTextElements.find((element) => element.id === textId);
        if (textElement) textElement.transform = { ...textElement.transform, zIndex: i + 1 };
      } else if (isBuiltInElementId(eid)) {
        nextTransforms[eid] = { ...cur, zIndex: i + 1 };
      }
    });
    onChange({ transforms: nextTransforms, textElements: nextTextElements });
  }

  return (
    <Card className="space-y-3 bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs font-semibold">Elements</Label>
          <p className="text-[11px] text-muted-foreground">
            {activeId
              ? "Fine-tune the selected element's geometry, rotation, and stacking — or focus it on the canvas and use arrow keys."
              : "Click or Tab to an element on the canvas to fine-tune its geometry, rotation, and stacking."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={addTextElement}
        >
          <Plus className="h-3.5 w-3.5" />
          Text
        </Button>
      </div>

      {activeId ? (
        <ActiveElementPanel
          activeId={activeId}
          transform={activeTransform}
          textElement={activeTextElement || undefined}
          locale={locale}
          onRotate={(rotation) => patchElement(activeId, { rotation })}
          onRect={(patch) => patchElement(activeId, patch)}
          onReorder={(dir) => reorder(activeId, dir)}
          onTextChange={(value) => {
            if (activeTextElement) setTextElementValue(activeTextElement, value);
          }}
          onTextPatch={(patch) => {
            if (activeTextElement) patchTextElement(activeTextElement.id, patch);
          }}
          onDeleteText={() => {
            if (activeTextElement) deleteTextElement(activeTextElement);
          }}
        />
      ) : (
        <div className="rounded border border-dashed bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
          No element selected
        </div>
      )}
    </Card>
  );
}

function ActiveElementPanel({
  activeId,
  transform,
  textElement,
  locale,
  onRotate,
  onRect,
  onReorder,
  onTextChange,
  onTextPatch,
  onDeleteText,
}: {
  activeId: ElementId;
  transform: ElementTransform | undefined;
  textElement?: TextElement;
  locale: string;
  onRotate: (rotation: number) => void;
  onRect: (patch: Partial<ElementTransform>) => void;
  onReorder: (dir: "front" | "back" | "up" | "down") => void;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
  onDeleteText: () => void;
}) {
  const engaged = !!transform;
  const rotation = transform?.rotation ?? 0;
  const label = elementLabel(activeId);
  return (
    <div className="space-y-2 rounded border bg-background/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium">
          {textElement && <Type className="h-3.5 w-3.5" />}
          {label}
        </span>
        {textElement ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:text-destructive"
            onClick={onDeleteText}
            title="Delete text element"
            aria-label="Delete text element"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : !engaged ? (
          <span className="text-[10px] text-muted-foreground">drag to enable</span>
        ) : null}
      </div>

      {textElement && (
        <TextElementPanel
          element={textElement}
          locale={locale}
          onTextChange={onTextChange}
          onTextPatch={onTextPatch}
        />
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <RotateCw className="h-3 w-3" /> Rotation
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {rotation}°
          </span>
        </div>
        <Slider
          min={-180}
          max={180}
          step={1}
          value={[rotation]}
          disabled={!engaged}
          onValueChange={([value]) => onRotate(value)}
          aria-label={`${label} rotation`}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">
          Position &amp; size <span className="opacity-70">(canvas px)</span>
        </Label>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["x", "X", transform?.x],
              ["y", "Y", transform?.y],
              ["width", "W", transform?.width],
              ["height", "H", transform?.height],
            ] as const
          ).map(([key, short, val]) => (
            <div key={key} className="space-y-0.5">
              <Label
                htmlFor={`el-${activeId}-${key}`}
                className="text-[10px] uppercase text-muted-foreground"
              >
                {short}
              </Label>
              <Input
                id={`el-${activeId}-${key}`}
                type="number"
                className="h-7 px-1.5 text-xs tabular-nums"
                value={val === undefined ? "" : Math.round(val)}
                min={key === "width" || key === "height" ? 1 : undefined}
                step={key === "width" || key === "height" ? 10 : 8}
                disabled={!engaged}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  onRect({ [key]: key === "width" || key === "height" ? Math.max(1, n) : n });
                }}
                aria-label={`${label} ${key}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Layer</Label>
        <div className="grid grid-cols-4 gap-1">
          <LayerButton disabled={!engaged} onClick={() => onReorder("back")} label="Send to back">
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("down")} label="Send backward">
            <ChevronDown className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("up")} label="Bring forward">
            <ChevronUp className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("front")} label="Bring to front">
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </LayerButton>
        </div>
      </div>
    </div>
  );
}

function TextElementPanel({
  element,
  locale,
  onTextChange,
  onTextPatch,
}: {
  element: TextElement;
  locale: string;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
}) {
  const text = element.text?.[locale] ?? pickText(element.text, locale);
  return (
    <div className="space-y-2 rounded border bg-muted/30 p-2">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Text</Label>
        <Textarea
          value={text}
          rows={2}
          dir="auto"
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Overlay text"
        />
      </div>
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Size</Label>
          <Input
            type="number"
            min={12}
            max={400}
            value={Math.round(element.fontSize || 72)}
            onChange={(event) => onTextPatch({ fontSize: Number(event.target.value) || 72 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Color</Label>
          <Input
            type="color"
            value={element.color || "#171717"}
            className="h-9 p-1"
            onChange={(event) => onTextPatch({ color: event.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "left" })}
          label="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "center" })}
          label="Align center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "right" })}
          label="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </LayerButton>
      </div>
    </div>
  );
}

function LayerButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-0"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function elementLabel(id: ElementId): string {
  if (isBuiltInElementId(id)) return ELEMENT_LABEL[id];
  return "Text";
}

function defaultZ(id: ElementId): number {
  if (isTextElementId(id)) return 5;
  if (id === "deviceSecondary") return 2;
  if (id === "device") return 3;
  return 4; // caption on top
}
