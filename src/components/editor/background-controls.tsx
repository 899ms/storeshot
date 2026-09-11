"use client";
import * as React from "react";
import { Image as ImageIcon, Layers, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Slider } from "@/components/ui/slider";
import type { BackgroundStyle, ScreenBackground } from "@/lib/types";
import { MESH_PRESETS, type MeshPresetTone } from "@/lib/mesh-presets";
import { meshBackground } from "./slide-canvas";
import { ScreenshotPicker } from "./screenshot-picker";

// Default mesh palette used when switching a background to mesh mode.
export const DEFAULT_MESH_COLORS = ["#4F46E5", "#8B5CF6", "#EC4899"];

type Mode = "default" | "theme" | "mesh" | "image";

function modeOf(value: ScreenBackground | undefined): Mode {
  if (!value) return "default";
  return value.kind;
}

// Style tweaks carried across mode switches and kind edits so adjusting
// opacity then picking a preset doesn't wipe the adjustments.
function styleOf(value: ScreenBackground | undefined): BackgroundStyle {
  const style: BackgroundStyle = {};
  if (value?.opacity !== undefined) style.opacity = value.opacity;
  if (value?.blur !== undefined) style.blur = value.blur;
  if (value?.angle !== undefined) style.angle = value.angle;
  return style;
}

// Shared background editor used by Settings (project default) and the
// Inspector (per-screen override). With showDefault, "Project default"
// clears the override (onChange(undefined)).
export function BackgroundEditor({
  value,
  showDefault = false,
  onChange,
}: {
  value: ScreenBackground | undefined;
  showDefault?: boolean;
  onChange: (v: ScreenBackground | undefined) => void;
}) {
  const mode = modeOf(value);
  const style = styleOf(value);

  function setMode(next: Mode) {
    if (next === "default") {
      onChange(undefined);
    } else if (next === "theme") {
      onChange({ kind: "theme", ...style });
    } else if (next === "mesh") {
      onChange({
        kind: "mesh",
        colors:
          value?.kind === "mesh" && value.colors.length >= 2
            ? value.colors.slice(0, 4)
            : [...DEFAULT_MESH_COLORS],
        ...style,
      });
    } else {
      onChange({
        kind: "image",
        src: value?.kind === "image" ? value.src : "",
        ...style,
      });
    }
  }

  const modes = [
    ...(showDefault
      ? [{ value: "default" as const, label: "Default", icon: RotateCcw }]
      : []),
    { value: "mesh" as const, label: "Mesh", icon: Layers },
    { value: "image" as const, label: "Image", icon: ImageIcon },
  ];

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="text-xs" id="background-type-label">
          Background
        </Label>
        <SegmentedControl
          label="Background type"
          value={mode}
          options={modes}
          onChange={(v) => setMode(v)}
        />
      </div>

      {value?.kind === "mesh" && (
        <MeshEditor
          colors={value.colors}
          angle={value.angle}
          onChange={(colors) => onChange({ kind: "mesh", colors, ...style })}
        />
      )}

      {value?.kind === "image" && (
        <ScreenshotPicker
          label="Background image"
          value={value.src}
          onChange={(src) => onChange({ kind: "image", src, ...style })}
        />
      )}

      {value && (
        <Adjustments
          value={value}
          onPatch={(patch) => onChange({ ...value, ...patch })}
        />
      )}
    </div>
  );
}

function Adjustments({
  value,
  onPatch,
}: {
  value: ScreenBackground;
  onPatch: (patch: BackgroundStyle) => void;
}) {
  const opacityPct = Math.round((value.opacity ?? 1) * 100);
  const blur = value.blur ?? 0;
  const angle = value.angle ?? 160;

  return (
    <div className="space-y-2 rounded-md border border-border/70 p-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Opacity</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{opacityPct}%</span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[opacityPct]}
          onValueChange={([v]) => onPatch({ opacity: (v ?? 100) / 100 })}
          aria-label="Background opacity"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] text-muted-foreground">Blur</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{blur}px</span>
        </div>
        <Slider
          min={0}
          max={40}
          step={1}
          value={[blur]}
          onValueChange={([v]) => onPatch({ blur: v ?? 0 })}
          aria-label="Background blur"
        />
      </div>
      {value.kind === "mesh" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] text-muted-foreground">Angle</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">{angle}°</span>
          </div>
          <Slider
            min={0}
            max={360}
            step={1}
            value={[angle]}
            onValueChange={([v]) => onPatch({ angle: v ?? 160 })}
            aria-label="Mesh gradient angle"
          />
        </div>
      )}
    </div>
  );
}

function MeshEditor({
  colors,
  angle,
  onChange,
}: {
  colors: string[];
  angle?: number;
  onChange: (colors: string[]) => void;
}) {
  const [tone, setTone] = React.useState<"all" | MeshPresetTone>("all");
  const presets = React.useMemo(
    () => (tone === "all" ? MESH_PRESETS : MESH_PRESETS.filter((p) => p.tone === tone)),
    [tone],
  );
  const currentKey = colors.slice(0, 3).join(",").toLowerCase();

  function setColor(index: number, color: string) {
    onChange(colors.map((c, i) => (i === index ? color : c)));
  }

  return (
    <div className="space-y-2">
      <div
        aria-hidden
        className="h-16 w-full rounded-md border"
        style={{ background: meshBackground(colors.length >= 2 ? colors : DEFAULT_MESH_COLORS, angle) }}
      />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs">Presets ({presets.length})</Label>
          <div className="flex items-center gap-1">
            {(["all", "light", "dark"] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={tone === t ? "default" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[11px] capitalize"
                onClick={() => setTone(t)}
                aria-pressed={tone === t}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid max-h-44 grid-cols-5 gap-1.5 overflow-y-auto rounded-md border p-1.5">
          {presets.map((preset) => {
            const selected = preset.colors.join(",").toLowerCase() === currentKey;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => onChange([...preset.colors])}
                title={preset.name}
                aria-label={`Apply ${preset.name} preset`}
                aria-pressed={selected}
                className={
                  selected
                    ? "h-9 rounded-md border-2 border-primary ring-1 ring-primary/40"
                    : "h-9 rounded-md border border-border/60 hover:border-foreground/40"
                }
                style={{ background: meshBackground(preset.colors) }}
              />
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Custom colors</Label>
        {colors.map((color, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#888888"}
              className="h-8 w-10 shrink-0 cursor-pointer p-1"
              onChange={(e) => setColor(i, e.target.value)}
              aria-label={`Mesh color ${i + 1}`}
            />
            <Input
              value={color}
              onChange={(e) => setColor(i, e.target.value)}
              placeholder="#RRGGBB"
              spellCheck={false}
              className="h-8 font-mono text-xs"
              aria-label={`Mesh color ${i + 1} hex`}
            />
            {colors.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(colors.filter((_, j) => j !== i))}
                title={`Remove color ${i + 1}`}
                aria-label={`Remove color ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {colors.length < 4 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange([...colors, "#22D3EE"])}
        >
          <Plus className="h-3.5 w-3.5" /> Add color
        </Button>
      )}
    </div>
  );
}
