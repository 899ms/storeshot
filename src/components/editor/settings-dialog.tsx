"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, ExternalLink, FlaskConical, Globe, Image as ImageIcon, Info, KeyRound, Plus, RotateCcw, Smartphone, Trash2, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  activeProvider,
  testProviderConnection,
  useAppSettings,
  type ProviderConfig,
} from "@/lib/app-settings";
import { getLocaleFlag, getLocaleLabel, LOCALE_NAMES } from "@/lib/locale";
import { CURATED_FONTS, curatedWeights, ensureFontLoaded, fontStack } from "@/lib/fonts";
import { CANVAS, DEVICE_LABEL, DEVICE_SIZE_PRESETS, effectiveCanvas } from "@/lib/constants";
import {
  DEFAULT_HEADLINE_SIZE_FACTOR,
  DEFAULT_HEADLINE_WEIGHT,
  DEFAULT_LABEL_SIZE_FACTOR,
  DEFAULT_LABEL_WEIGHT,
  MAX_SIZE_FACTOR,
  MIN_SIZE_FACTOR,
} from "@/lib/caption-style";
import type { CanvasSize, Device, FrameFinish, GlobalTextStyle, ScreenBackground } from "@/lib/types";
import { BackgroundEditor } from "./background-controls";
import { Slider } from "@/components/ui/slider";
import { getAppVersion } from "@/lib/native";
import { cn } from "@/lib/utils";

const FRAME_FINISHES: { id: FrameFinish; label: string; swatch: string }[] = [
  { id: "titanium", label: "Titanium", swatch: "linear-gradient(135deg, #44444a, #18181c)" },
  { id: "black", label: "Black", swatch: "linear-gradient(135deg, #1c1c20, #000000)" },
  { id: "white", label: "White", swatch: "linear-gradient(135deg, #f2f2f5, #a9a9b2)" },
  { id: "none", label: "None", swatch: "linear-gradient(135deg, #e5e5e5 25%, #fff 25%, #fff 50%, #e5e5e5 50%, #e5e5e5 75%, #fff 75%)" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  currentLocale: string;
  headlineFont: string;
  labelFont: string;
  headlineText?: GlobalTextStyle;
  labelText?: GlobalTextStyle;
  headlineAutoColor: string;
  labelAutoColor: string;
  background: ScreenBackground;
  canvasSizes?: Partial<Record<Device, CanvasSize>>;
  frames?: Partial<Record<"phone" | "tablet", FrameFinish>>;
  disabled?: boolean;
  onAddLocale: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onHeadlineFontChange: (family: string) => void;
  onLabelFontChange: (family: string) => void;
  onHeadlineTextChange: (style: GlobalTextStyle | undefined) => void;
  onLabelTextChange: (style: GlobalTextStyle | undefined) => void;
  onBackgroundChange: (background: ScreenBackground) => void;
  onCanvasSizeChange: (device: Device, size: CanvasSize) => void;
  onResetCanvasSize: (device: Device) => void;
  onFrameChange: (device: "phone" | "tablet", finish: FrameFinish) => void;
  onSelectLocale: (locale: string) => void;
  initialTab?: string;
};

export function SettingsDialog({
  open,
  onOpenChange,
  locales,
  currentLocale,
  headlineFont,
  labelFont,
  headlineText,
  labelText,
  headlineAutoColor,
  labelAutoColor,
  background,
  canvasSizes,
  frames,
  disabled,
  onAddLocale,
  onRemoveLocale,
  onHeadlineFontChange,
  onLabelFontChange,
  onHeadlineTextChange,
  onLabelTextChange,
  onBackgroundChange,
  onCanvasSizeChange,
  onResetCanvasSize,
  onFrameChange,
  onSelectLocale,
  initialTab,
}: Props) {
  const { settings, setSettings, patchProvider, addProvider, removeProvider } =
    useAppSettings();
  // Controlled tab so callers (e.g. the toolbar locale menu) can open the
  // dialog directly on a specific tab. Synced on open only, so tab switches
  // inside an open dialog are never overridden. Legacy "model" maps to the
  // merged providers tab.
  const initial = initialTab === "model" ? "providers" : (initialTab ?? "providers");
  const [tab, setTab] = React.useState(initial);
  React.useEffect(() => {
    if (open && initialTab) setTab(initialTab === "model" ? "providers" : initialTab);
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[600px] max-h-[70vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 gap-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base font-bold">Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Providers, devices, background, text, and project languages. API keys stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-6 pt-3">
            <TabsList className="h-8">
              <TabsTrigger value="providers" className="gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Providers & Model
              </TabsTrigger>
              <TabsTrigger value="devices" className="gap-1.5 text-xs">
                <Smartphone className="h-3.5 w-3.5" /> Devices
              </TabsTrigger>
              <TabsTrigger value="background" className="gap-1.5 text-xs">
                <ImageIcon className="h-3.5 w-3.5" /> Background
              </TabsTrigger>
              <TabsTrigger value="fonts" className="gap-1.5 text-xs">
                <Type className="h-3.5 w-3.5" /> Text
              </TabsTrigger>
              <TabsTrigger value="locales" className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" /> Locales ({locales.length})
              </TabsTrigger>
              <TabsTrigger value="about" className="gap-1.5 text-xs">
                <Info className="h-3.5 w-3.5" /> About
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="providers" className="mt-0 space-y-4">
              <ProvidersTab
                settings={settings}
                onSelect={(id) => setSettings((p) => ({ ...p, activeProviderId: id }))}
                onPatch={patchProvider}
                onAdd={addProvider}
                onRemove={removeProvider}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Model Slug</Label>
                <Input
                  value={settings.model}
                  onChange={(e) => setSettings((p) => ({ ...p, model: e.target.value }))}
                  placeholder="deepseek/deepseek-v4-flash"
                  spellCheck={false}
                  className="h-8 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used with {activeProvider(settings).label} ({activeProvider(settings).baseUrl}).
                  Any <code>provider/model</code> slug works.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="devices" className="mt-0 space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Screen dimensions drive the canvas and export resolution.
                Element positions are absolute canvas pixels and re-clamp when a canvas shrinks.
              </p>
              {(["phone", "tablet", "desktop"] as const).map((device) => (
                <DeviceSizeRow
                  key={device}
                  device={device}
                  current={effectiveCanvas(device, canvasSizes)}
                  isCustom={canvasSizes?.[device] !== undefined}
                  frame={device === "desktop" ? undefined : (frames?.[device] ?? "titanium")}
                  disabled={disabled}
                  onPreset={(size) => onCanvasSizeChange(device, size)}
                  onCustom={(size) => onCanvasSizeChange(device, size)}
                  onReset={() => onResetCanvasSize(device)}
                  onFrame={
                    device === "desktop"
                      ? undefined
                      : (finish) => onFrameChange(device, finish)
                  }
                />
              ))}
            </TabsContent>
            <TabsContent value="background" className="mt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Default Background</Label>
                <p className="text-[11px] text-muted-foreground">
                  Used for new screens and any screen without its own override.
                  Changing it restyles existing screens that use the default.
                </p>
                <BackgroundEditor
                  value={background}
                  onChange={(v) => {
                    if (v) onBackgroundChange(v);
                  }}
                />
              </div>
            </TabsContent>
            <TabsContent value="fonts" className="mt-0 space-y-4">
              <p className="text-[11px] text-muted-foreground">
                Global defaults for every screen. Per-screen overrides in the
                inspector still win; clearing an override falls back here.
              </p>
              <TextRoleSection
                title="Headline"
                hint="Big multi-line headline on each screen"
                family={headlineFont}
                style={headlineText}
                builtinWeight={DEFAULT_HEADLINE_WEIGHT}
                builtinFactor={DEFAULT_HEADLINE_SIZE_FACTOR}
                autoColor={headlineAutoColor}
                previewLines={["Design once,", "export everywhere."]}
                previewUppercase={false}
                disabled={disabled}
                onFamilyChange={(family) => {
                  void ensureFontLoaded(family);
                  onHeadlineFontChange(family);
                  onHeadlineTextChange(snapStyleToFamily(headlineText, family, DEFAULT_HEADLINE_WEIGHT));
                }}
                onStyleChange={onHeadlineTextChange}
              />
              <TextRoleSection
                title="Label"
                hint="Small title above the headline"
                family={labelFont}
                style={labelText}
                builtinWeight={DEFAULT_LABEL_WEIGHT}
                builtinFactor={DEFAULT_LABEL_SIZE_FACTOR}
                autoColor={labelAutoColor}
                previewLines={["FEATURE 01"]}
                previewUppercase
                disabled={disabled}
                onFamilyChange={(family) => {
                  void ensureFontLoaded(family);
                  onLabelFontChange(family);
                  onLabelTextChange(snapStyleToFamily(labelText, family, DEFAULT_LABEL_WEIGHT));
                }}
                onStyleChange={onLabelTextChange}
              />
            </TabsContent>
            <TabsContent value="locales" className="mt-0 space-y-3">
              <LocalesTab
                locales={locales}
                currentLocale={currentLocale}
                disabled={disabled}
                onAdd={onAddLocale}
                onRemove={onRemoveLocale}
                onSelect={(locale) => {
                  onSelectLocale(locale);
                  onOpenChange(false);
                }}
              />
            </TabsContent>
            <TabsContent value="about" className="mt-0 space-y-4">
              <AboutTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AboutTab() {
  const appVersion = getAppVersion();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          StoreShot{appVersion ? ` ${appVersion}` : ""}
        </h3>
        <p className="text-xs text-muted-foreground">
          Design App Store and Google Play marketing screenshots on a connected canvas.
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Built by Stackwares</span>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href="https://github.com/stackwares/storeshot-electron" target="_blank" rel="noreferrer">
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Founder — Oliver Martinez</span>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" asChild>
            <a href="https://bio.nexl.ink/oliverbytes" target="_blank" rel="noreferrer">
              Bio <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">MIT licensed — see LICENSE in the repo.</p>
      </div>
    </div>
  );
}

function DeviceSizeRow({
  device,
  current,
  isCustom,
  frame,
  disabled,
  onPreset,
  onCustom,
  onReset,
  onFrame,
}: {
  device: Device;
  current: CanvasSize;
  isCustom: boolean;
  frame?: FrameFinish;
  disabled?: boolean;
  onPreset: (size: CanvasSize) => void;
  onCustom: (size: CanvasSize) => void;
  onReset: () => void;
  onFrame?: (finish: FrameFinish) => void;
}) {
  const presets = DEVICE_SIZE_PRESETS[device];
  const matched = presets.find((p) => p.w === current.w && p.h === current.h);
  const [wText, setWText] = React.useState(String(current.w));
  const [hText, setHText] = React.useState(String(current.h));
  // Resync when another control (preset/reset) changes the size.
  React.useEffect(() => {
    setWText(String(current.w));
    setHText(String(current.h));
  }, [current.w, current.h]);

  function commitCustom() {
    const w = Math.round(Number(wText));
    const h = Math.round(Number(hText));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    const clamped = {
      w: Math.min(5000, Math.max(200, w)),
      h: Math.min(5000, Math.max(200, h)),
    };
    if (clamped.w !== current.w || clamped.h !== current.h) {
      onCustom(clamped);
    } else {
      setWText(String(current.w));
      setHText(String(current.h));
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">
          {DEVICE_LABEL[device]}
          <span className="ml-1.5 font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
            {current.w} × {current.h}
          </span>
        </span>
        {isCustom ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={onReset}
            disabled={disabled}
            title={`Reset ${DEVICE_LABEL[device]} to ${CANVAS[device].w} × ${CANVAS[device].h}`}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Preset</Label>
        <Select
          value={matched ? `${matched.w}x${matched.h}` : "custom"}
          onValueChange={(v) => {
            if (v === "custom") return;
            const preset = presets.find((p) => `${p.w}x${p.h}` === v);
            if (preset) onPreset({ w: preset.w, h: preset.h });
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((p) => (
              <SelectItem key={`${p.w}x${p.h}`} value={`${p.w}x${p.h}`}>
                {p.label}
              </SelectItem>
            ))}
            {!matched ? <SelectItem value="custom">Custom ({current.w} × {current.h})</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Width (px)</Label>
          <Input
            type="number"
            min={200}
            max={5000}
            value={wText}
            disabled={disabled}
            onChange={(e) => setWText(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 font-mono text-xs tabular-nums"
            aria-label={`${DEVICE_LABEL[device]} width`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Height (px)</Label>
          <Input
            type="number"
            min={200}
            max={5000}
            value={hText}
            disabled={disabled}
            onChange={(e) => setHText(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 font-mono text-xs tabular-nums"
            aria-label={`${DEVICE_LABEL[device]} height`}
          />
        </div>
      </div>
      {onFrame ? (
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Mockup Frame</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${DEVICE_LABEL[device]} mockup frame`}>
            {FRAME_FINISHES.map((finish) => {
              const selected = (frame ?? "titanium") === finish.id;
              return (
                <button
                  key={finish.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onFrame(finish.id)}
                  disabled={disabled}
                  title={finish.id === "none" ? "No bezel — edge-to-edge screenshot" : `${finish.label} chassis`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]",
                    selected
                      ? "border-figma-accent bg-figma-accent-soft text-figma-text"
                      : "border-figma-divider text-figma-secondary hover:bg-figma-hover hover:text-figma-text",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full border border-black/20"
                    style={{ background: finish.swatch }}
                  />
                  {finish.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Desktop renders frameless, full-bleed.</p>
      )}
    </div>
  );
}

function ProvidersTab({
  settings,
  onSelect,
  onPatch,
  onAdd,
  onRemove,
}: {
  settings: { providers: ProviderConfig[]; activeProviderId: string };
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<ProviderConfig>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<
    Record<string, { ok: true; modelCount: number } | { ok: false; error: string }>
  >({});

  async function runTest(provider: ProviderConfig) {
    setTestingId(provider.id);
    const result = await testProviderConnection(provider);
    setTestingId(null);
    setResults((prev) => ({ ...prev, [provider.id]: result }));
  }

  return (
    <div className="space-y-3">
      {settings.providers.map((provider) => {
        const isActive = provider.id === settings.activeProviderId;
        const result = results[provider.id];
        return (
          <Card
            key={provider.id}
            className={cn(
              "space-y-2.5 p-3 shadow-none",
              isActive ? "border-primary/60" : "border-border/80",
            )}
          >
            <div className="flex items-center gap-2">
              <Input
                value={provider.label}
                onChange={(e) => onPatch(provider.id, { label: e.target.value })}
                className="h-7 text-xs font-semibold"
                aria-label="Provider name"
              />
              {isActive ? (
                <Badge className="shrink-0 text-[10px]">Active</Badge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 text-[11px]"
                  onClick={() => onSelect(provider.id)}
                >
                  Use
                </Button>
              )}
              {settings.providers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(provider.id)}
                  title="Remove provider"
                  aria-label={`Remove ${provider.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Base URL</Label>
              <Input
                value={provider.baseUrl}
                onChange={(e) => onPatch(provider.id, { baseUrl: e.target.value })}
                placeholder="https://openrouter.ai/api/v1"
                spellCheck={false}
                className="h-7 font-mono text-[11px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">API key</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={provider.apiKey}
                  onChange={(e) => onPatch(provider.id, { apiKey: e.target.value })}
                  placeholder="sk-or-…"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-7 font-mono text-[11px]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1 text-[11px]"
                  onClick={() => void runTest(provider)}
                  disabled={testingId === provider.id}
                >
                  <FlaskConical className="h-3 w-3" />
                  {testingId === provider.id ? "Testing…" : "Test"}
                </Button>
              </div>
              {result &&
                (result.ok ? (
                  <p className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" /> Connected — {result.modelCount} models available.
                  </p>
                ) : (
                  <p className="text-[11px] text-destructive">{result.error}</p>
                ))}
            </div>
          </Card>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Add provider
      </Button>
    </div>
  );
}

/** Snap a stored global weight onto a newly picked family's available weights. */
function snapStyleToFamily(
  style: GlobalTextStyle | undefined,
  family: string,
  builtinWeight: number,
): GlobalTextStyle | undefined {
  if (!style) return undefined;
  const weights = curatedWeights(family);
  const current = style.fontWeight;
  if (current === undefined || weights.includes(current)) return style;
  const snapped = weights.includes(builtinWeight) ? builtinWeight : weights[0];
  const next = { ...style, fontWeight: snapped };
  if (
    next.fontWeight === builtinWeight &&
    next.sizeFactor === undefined &&
    next.color === undefined
  ) {
    return undefined;
  }
  return next;
}

/** Reference canvas unit for px previews (Phone: min(1320, 2868)). */
const PREVIEW_UNIT = Math.min(CANVAS.phone.w, CANVAS.phone.h);

function TextRoleSection({
  title,
  hint,
  family,
  style,
  builtinWeight,
  builtinFactor,
  autoColor,
  previewLines,
  previewUppercase,
  disabled,
  onFamilyChange,
  onStyleChange,
}: {
  title: string;
  hint: string;
  family: string;
  style?: GlobalTextStyle;
  builtinWeight: number;
  builtinFactor: number;
  autoColor: string;
  previewLines: string[];
  previewUppercase?: boolean;
  disabled?: boolean;
  onFamilyChange: (family: string) => void;
  onStyleChange: (style: GlobalTextStyle | undefined) => void;
}) {
  const weights = curatedWeights(family);
  const weight = style?.fontWeight !== undefined && weights.includes(style.fontWeight)
    ? style.fontWeight
    : weights.includes(builtinWeight)
      ? builtinWeight
      : (weights[0] ?? builtinWeight);
  const factor = style?.sizeFactor ?? builtinFactor;
  const percent = factor * 100;
  const color = style?.color ?? autoColor;
  const isDefaulted = style === undefined;

  function patch(patch: Partial<GlobalTextStyle>) {
    const next: GlobalTextStyle = { ...style, ...patch };
    // Storing undefined-when-builtin keeps project files minimal and makes
    // "Reset" a natural delete.
    if (next.fontWeight === builtinWeight) delete next.fontWeight;
    if (next.sizeFactor === builtinFactor) delete next.sizeFactor;
    onStyleChange(
      next.fontWeight === undefined && next.sizeFactor === undefined && next.color === undefined
        ? undefined
        : next,
    );
  }

  function setPercentText(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(MAX_SIZE_FACTOR, Math.max(MIN_SIZE_FACTOR, n / 100));
    patch({ sizeFactor: Math.round(clamped * 10000) / 10000 });
  }

  React.useEffect(() => {
    void ensureFontLoaded(family);
  }, [family]);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-semibold">{title}</Label>
        <span className="truncate text-[10px] text-muted-foreground">{hint}</span>
      </div>
      {/* Live preview in the chosen style */}
      <div
        aria-hidden
        className="rounded bg-muted/40 px-3 py-2"
        style={{
          fontFamily: fontStack(family),
          fontWeight: weight,
          color,
        }}
      >
        {previewLines.map((line, i) => (
          <div
            key={i}
            className={previewUppercase ? "text-xs font-semibold uppercase tracking-widest" : "text-xl font-bold leading-tight"}
            style={previewUppercase ? undefined : { letterSpacing: "-0.01em" }}
          >
            {line}
          </div>
        ))}
      </div>
      <FontPicker
        label={`${title} font`}
        hint={`${CURATED_FONTS.length} fonts`}
        value={family}
        disabled={disabled}
        onSelect={onFamilyChange}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Weight</Label>
          <Select
            value={String(weight)}
            onValueChange={(v) => patch({ fontWeight: Number(v) })}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weights.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}{w === builtinWeight ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Color</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="color"
              value={color}
              disabled={disabled}
              onChange={(e) => patch({ color: e.target.value })}
              className="h-8 w-10 shrink-0 p-1"
              aria-label={`${title} color`}
            />
            {style?.color !== undefined ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px]"
                disabled={disabled}
                onClick={() => patch({ color: undefined })}
                title="Follow theme automatically"
              >
                Auto
              </Button>
            ) : (
              <span className="text-[10px] text-muted-foreground">Auto (theme)</span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <Label className="text-[11px] text-muted-foreground">Size</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {percent.toFixed(1)}% · ≈{Math.round(factor * PREVIEW_UNIT)}px at Phone
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Slider
            min={MIN_SIZE_FACTOR * 100}
            max={MAX_SIZE_FACTOR * 100}
            step={0.5}
            value={[percent]}
            disabled={disabled}
            onValueChange={([v]) => setPercentText(String(v))}
            aria-label={`${title} size percent`}
            className="flex-1"
          />
          <Input
            type="number"
            min={MIN_SIZE_FACTOR * 100}
            max={MAX_SIZE_FACTOR * 100}
            step={0.5}
            value={Math.round(percent * 10) / 10}
            disabled={disabled}
            onChange={(e) => setPercentText(e.target.value)}
            className="h-8 w-20 font-mono text-xs tabular-nums"
            aria-label={`${title} size percent`}
          />
        </div>
      </div>
      {!isDefaulted ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground"
            disabled={disabled}
            onClick={() => onStyleChange(undefined)}
            title={`Reset ${title} to built-in defaults`}
          >
            Reset to defaults
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FontPicker({
  label,
  hint,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  value: string;
  disabled?: boolean;
  onSelect: (family: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_FONTS;
    return CURATED_FONTS.filter((f) => f.family.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="truncate text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${CURATED_FONTS.length} fonts…`}
        aria-label={`Search ${label} fonts`}
        className="h-8 text-xs"
        disabled={disabled}
      />
      <div role="group" aria-label={`${label} font`} className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
        {filtered.map((f) => (
          <FontRow
            key={f.family}
            family={f.family}
            blurb={f.blurb}
            selected={value === f.family}
            disabled={disabled}
            onSelect={() => onSelect(f.family)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No fonts match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}

function FontRow({
  family,
  blurb,
  selected,
  disabled,
  onSelect,
}: {
  family: string;
  blurb: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = React.useState(false);
  // Load this family's stylesheet only once the row scrolls near the
  // viewport — opening Fonts no longer downloads all 30 families.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (visible) void ensureFontLoaded(family);
  }, [visible, family]);

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors disabled:opacity-40",
        selected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted/60",
      )}
    >
      <span
        aria-hidden
        className="w-10 shrink-0 text-center text-xl leading-none"
        style={visible ? { fontFamily: fontStack(family) } : undefined}
      >
        Ag
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm leading-tight"
          style={visible ? { fontFamily: fontStack(family) } : undefined}
        >
          {family}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">{blurb}</span>
      </span>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

function LocalesTab({
  locales,
  currentLocale,
  disabled,
  onAdd,
  onRemove,
  onSelect,
}: {
  locales: string[];
  currentLocale: string;
  disabled?: boolean;
  onAdd: (locale: string) => void;
  onRemove: (locale: string) => void;
  onSelect: (locale: string) => void;
}) {
  const available = React.useMemo(
    () => Object.keys(LOCALE_NAMES).filter((l) => !locales.includes(l)).sort(),
    [locales],
  );
  const [query, setQuery] = React.useState<string>("");
  const filteredAvailable = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((l) =>
      `${l} ${getLocaleLabel(l)}`.toLowerCase().includes(q),
    );
  }, [available, query]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {locales.map((loc) => (
            <span
              key={loc}
              className="flex items-center gap-1 rounded-md border bg-card py-1 pl-1 pr-1.5 text-xs"
            >
              <button
                type="button"
                className="flex min-h-7 items-center gap-1.5 rounded px-1 hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => onSelect(loc)}
                disabled={disabled || loc === currentLocale}
                title={loc === currentLocale ? `Editing ${loc}` : `Switch editing to ${loc}`}
                aria-label={loc === currentLocale ? `${loc}, currently editing` : `Switch editing to ${loc}`}
              >
                <span>
                  {getLocaleFlag(loc)} {getLocaleLabel(loc)}
                </span>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">({loc})</span>
                {loc === currentLocale && (
                  <Badge variant="secondary" className="px-1 py-0 text-[9px]">
                    editing
                  </Badge>
                )}
                {loc === "en" && (
                  <Badge variant="outline" className="px-1 py-0 text-[9px]">
                    source
                  </Badge>
                )}
              </button>
              {locales.length > 1 && (
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                  onClick={() => {
                    onRemove(loc);
                    toast(`Removed ${loc} from editor`, {
                      description: "Saved texts are kept — re-add anytime to restore.",
                      action: {
                        label: "Undo",
                        onClick: () => onAdd(loc),
                      },
                      duration: 6000,
                    });
                  }}
                  disabled={disabled}
                  title={`Remove ${loc}`}
                  aria-label={`Remove ${loc}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">
            Supported locales ({locales.length}/{Object.keys(LOCALE_NAMES).length})
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px]"
              disabled={disabled || available.length === 0}
              onClick={() => {
                for (const l of available) onAdd(l);
                setQuery("");
              }}
            >
              Select all
            </Button>
            <span className="text-[11px] text-muted-foreground">•</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-[11px] text-muted-foreground"
              disabled={disabled || locales.length <= 1}
              onClick={() => {
                const removed = locales.filter((l) => l !== currentLocale);
                for (const l of removed) onRemove(l);
                if (removed.length > 0) {
                  toast(`Removed ${removed.length} languages from editor`, {
                    description: "Saved texts are kept — re-add anytime to restore.",
                    action: {
                      label: "Undo",
                      onClick: () => {
                        for (const l of removed) onAdd(l);
                      },
                    },
                    duration: 6000,
                  });
                }
              }}
            >
              Deselect all
            </Button>
          </div>
        </div>
        {available.length > 0 ? (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locales…"
              aria-label="Search locales"
              className="h-9 text-xs"
              disabled={disabled}
            />
            {filteredAvailable.length > 0 ? (
              <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-1">
                {filteredAvailable.map((l) => (
                  <button
                    type="button"
                    key={l}
                    className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-xs hover:bg-muted/60 disabled:opacity-40"
                    onClick={() => {
                      onAdd(l);
                      toast(`Added ${l} to editor`, {
                        action: {
                          label: "Undo",
                          onClick: () => onRemove(l),
                        },
                        duration: 6000,
                      });
                    }}
                    disabled={disabled}
                    title={`Add ${getLocaleLabel(l)} (${l})`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {getLocaleFlag(l)} {getLocaleLabel(l)}{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">({l})</span>
                    </span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No locales match “{query.trim()}”.</p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            All {Object.keys(LOCALE_NAMES).length} supported locales are in your project.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Removing a language keeps its saved texts in the project file but hides it from the
          editor and exports. English (en) is always the translation source.
        </p>
      </div>
    </div>
  );
}
