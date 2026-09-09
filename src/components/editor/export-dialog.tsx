"use client";

import * as React from "react";
import {
  AlertTriangle,
  Apple,
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  FolderTree,
  Globe,
  Layers,
  Monitor,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXPORT_TARGETS,
  ExportConfig,
  ExportTarget,
  FolderPreset,
} from "@/lib/export-options";
import { getLocaleLabel } from "@/lib/locale";
import type { Slide } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: Slide[];
  activeSlideId: string | null;
  locales: string[];
  currentLocale: string;
  onStartExport: (config: ExportConfig) => void;
  onQuickExportActive: () => void;
  exporting: string | null;
};

export function ExportDialog({
  open,
  onOpenChange,
  slides,
  activeSlideId,
  locales,
  currentLocale,
  onStartExport,
  onQuickExportActive,
  exporting,
}: Props) {
  // Default selected targets: all targets marked defaultSelected
  const [selectedTargetIds, setSelectedTargetIds] = React.useState<string[]>(() =>
    EXPORT_TARGETS.filter((t) => t.defaultSelected).map((t) => t.id),
  );

  // Default selected locales: all project locales
  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(locales);

  // Default selected slides: all slides
  const [selectedSlideIds, setSelectedSlideIds] = React.useState<string[]>(() =>
    slides.map((s) => s.id),
  );

  // Folder packaging preset
  const [folderPreset, setFolderPreset] = React.useState<FolderPreset>("standard");

  // Keep state synced when props change
  React.useEffect(() => {
    if (open) {
      setSelectedLocales((prev) => (prev.length === 0 ? locales : prev));
      setSelectedSlideIds((prev) => (prev.length === 0 ? slides.map((s) => s.id) : prev));
    }
  }, [open, locales, slides]);

  // Target toggle handlers
  const toggleTarget = (id: string) => {
    setSelectedTargetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectRecommendedTargets = () => {
    setSelectedTargetIds(
      EXPORT_TARGETS.filter((t) => t.recommended).map((t) => t.id),
    );
  };

  const selectAllTargets = () => {
    setSelectedTargetIds(EXPORT_TARGETS.map((t) => t.id));
  };

  // Locale toggle handlers
  const toggleLocale = (locale: string) => {
    setSelectedLocales((prev) => {
      if (prev.includes(locale)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((l) => l !== locale);
      }
      return [...prev, locale];
    });
  };

  const selectAllLocales = () => setSelectedLocales([...locales]);
  const selectOnlyCurrentLocale = () => setSelectedLocales([currentLocale]);

  // Slide toggle handlers
  const toggleSlide = (id: string) => {
    setSelectedSlideIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((sId) => sId !== id);
      }
      return [...prev, id];
    });
  };

  const selectAllSlides = () => setSelectedSlideIds(slides.map((s) => s.id));

  // Calculations & stats
  const selectedTargets = EXPORT_TARGETS.filter((t) => selectedTargetIds.includes(t.id));
  const totalScreenshots =
    selectedTargets.length * selectedLocales.length * selectedSlideIds.length;

  // Pre-flight checks
  const missingScreenshotsCount = slides
    .filter((s) => selectedSlideIds.includes(s.id))
    .filter((s) => s.layout !== "no-device" && !s.screenshot).length;

  const handleExport = () => {
    onStartExport({
      selectedTargetIds,
      selectedLocales,
      selectedSlideIds,
      folderPreset,
    });
    onOpenChange(false);
  };

  const iosTargets = EXPORT_TARGETS.filter((t) => t.platform === "ios");
  const androidTargets = EXPORT_TARGETS.filter((t) => t.platform === "android");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Export Screenshots
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Choose target stores, device resolutions, and packaging format.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-5 space-y-6">
          {/* 1. Target Platforms & Devices */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Target Platforms & Store Sizes
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectRecommendedTargets}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Recommended
                </button>
                <span className="text-xs text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={selectAllTargets}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Select all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Apple App Store */}
              <div className="rounded-lg border bg-card/60 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 pb-1 border-b text-xs font-semibold text-foreground">
                  <Apple className="h-4 w-4" />
                  <span>Apple App Store (iOS)</span>
                </div>
                <div className="space-y-2">
                  {iosTargets.map((target) => {
                    const isChecked = selectedTargetIds.includes(target.id);
                    return (
                      <div
                        key={target.id}
                        onClick={() => toggleTarget(target.id)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors",
                          isChecked
                            ? "border-primary/50 bg-primary/5 shadow-xs"
                            : "border-border/60 hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleTarget(target.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold leading-none truncate">
                              {target.name}
                            </span>
                            {target.badge && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                  target.recommended
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {target.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {target.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Google Play Store */}
              <div className="rounded-lg border bg-card/60 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 pb-1 border-b text-xs font-semibold text-foreground">
                  <Smartphone className="h-4 w-4" />
                  <span>Google Play Store (Android)</span>
                </div>
                <div className="space-y-2">
                  {androidTargets.map((target) => {
                    const isChecked = selectedTargetIds.includes(target.id);
                    return (
                      <div
                        key={target.id}
                        onClick={() => toggleTarget(target.id)}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-colors",
                          isChecked
                            ? "border-primary/50 bg-primary/5 shadow-xs"
                            : "border-border/60 hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleTarget(target.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold leading-none truncate">
                              {target.name}
                            </span>
                            {target.badge && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                                  target.recommended
                                    ? "bg-primary/15 text-primary"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {target.badge}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {target.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Locales & Screens Row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Locales */}
            <div className="rounded-lg border bg-card/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Locales ({selectedLocales.length}/{locales.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllLocales}
                    className="text-[11px] text-primary font-medium hover:underline"
                  >
                    All
                  </button>
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={selectOnlyCurrentLocale}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Current only
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {locales.map((loc) => {
                  const isChecked = selectedLocales.includes(loc);
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => toggleLocale(loc)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        isChecked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-muted text-foreground",
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      <span>{getLocaleLabel(loc)}</span>
                      <span className={cn("text-[10px] opacity-80 uppercase font-mono")}>
                        ({loc})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Packaging / Folder Structure */}
            <div className="rounded-lg border bg-card/60 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 pb-1 border-b text-xs font-semibold text-foreground">
                <FolderTree className="h-4 w-4" />
                <span>Folder Packaging Preset</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <Select
                  value={folderPreset}
                  onValueChange={(v) => setFolderPreset(v as FolderPreset)}
                >
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard" className="text-xs">
                      Standard Store Layout (by platform & device)
                    </SelectItem>
                    <SelectItem value="fastlane" className="text-xs">
                      Fastlane Deliver & Supply Preset (CI/CD)
                    </SelectItem>
                    <SelectItem value="flat" className="text-xs">
                      Flat ZIP (all files in root with prefixes)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {folderPreset === "standard" &&
                    "Organizes files into ios/iphone-6.9/en/01-hero.png & android/phone/en/01-hero.png"}
                  {folderPreset === "fastlane" &&
                    "Outputs directly into fastlane/screenshots/ and fastlane/metadata/ for automated delivery."}
                  {folderPreset === "flat" &&
                    "Puts all PNG files together in a single folder with standardized names."}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Screens Selection */}
          <div className="rounded-lg border bg-card/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Layers className="h-4 w-4" />
                <span>Screens to Include ({selectedSlideIds.length}/{slides.length})</span>
              </div>
              <button
                type="button"
                onClick={selectAllSlides}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 pt-1">
              {slides.map((slide, idx) => {
                const isChecked = selectedSlideIds.includes(slide.id);
                const isMissing = slide.layout !== "no-device" && !slide.screenshot;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => toggleSlide(slide.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-all",
                      isChecked
                        ? "border-primary/60 bg-primary/5 shadow-xs"
                        : "border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleSlide(slide.id)}
                      />
                    </div>
                    <span className="truncate text-xs font-medium capitalize">
                      {slide.layout.replace("-", " ")}
                    </span>
                    {isMissing && (
                      <span className="text-[9px] text-amber-500 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" /> No screenshot
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pre-flight Warnings */}
          {missingScreenshotsCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Notice:</strong> {missingScreenshotsCount} of the selected screens will export with empty device frames.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-col gap-2 border-t bg-muted/20 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onQuickExportActive();
              }}
              className="h-8 text-xs gap-1.5"
              title="Download currently selected screen as a single PNG"
            >
              <Download className="h-3.5 w-3.5" />
              Quick Export Current Screen
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                selectedTargetIds.length === 0 ||
                selectedLocales.length === 0 ||
                selectedSlideIds.length === 0 ||
                !!exporting
              }
              onClick={handleExport}
              className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Bundle ({totalScreenshots} PNG{totalScreenshots === 1 ? "" : "s"})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
