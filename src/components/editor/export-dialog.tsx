"use client";

import * as React from "react";
import {
  AlertTriangle,
  Apple,
  Check,
  Download,
  FolderTree,
  Globe,
  Layers,
  Package,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  EXPORT_TARGETS,
  ExportConfig,
  ExportTarget,
  FolderPreset,
} from "@/lib/export-options";
import { getLocaleFlag, getLocaleLabel } from "@/lib/locale";
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

  const deselectAllSlides = () => setSelectedSlideIds([]);

  // Calculations & stats
  const selectedTargets = EXPORT_TARGETS.filter((t) => selectedTargetIds.includes(t.id));
  const totalScreenshots =
    selectedTargets.length * selectedLocales.length * selectedSlideIds.length;

  const isExportDisabled =
    selectedTargetIds.length === 0 ||
    selectedLocales.length === 0 ||
    selectedSlideIds.length === 0 ||
    !!exporting;

  // Pre-flight checks
  const missingScreenshotsCount = slides
    .filter((s) => selectedSlideIds.includes(s.id))
    .filter((s) => s.layout !== "no-device" && !s.screenshot).length;

  const handleExport = () => {
    if (isExportDisabled) return;
    onStartExport({
      selectedTargetIds,
      selectedLocales,
      selectedSlideIds,
      folderPreset,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[60vh] h-[60vh] max-w-3xl overflow-hidden p-0 gap-0 sm:max-w-3xl">
        {/* Header with Top CTA */}
        <DialogHeader className="shrink-0 border-b px-6 py-3.5 bg-card/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Apple className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold tracking-tight">
                  Export App Store Screenshots
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  Choose devices, screens, and packaging format for your App Store bundle.
                </DialogDescription>
              </div>
            </div>

          </div>

          {/* Quick Summary Pill Bar */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <span className="flex items-center gap-1 text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <strong>{totalScreenshots} PNGs total</strong>
              </span>
              <span>•</span>
              <span>{selectedTargets.length} device{selectedTargets.length === 1 ? "" : "s"}</span>
              <span>•</span>
              <span>{selectedSlideIds.length} screen{selectedSlideIds.length === 1 ? "" : "s"}</span>
              <span>•</span>
              <span>{selectedLocales.length} locale{selectedLocales.length === 1 ? "" : "s"}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary hover:text-primary font-medium"
                onClick={selectRecommendedTargets}
              >
                Recommended
              </Button>
              <span className="text-[11px] text-muted-foreground">•</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={selectAllTargets}
              >
                Select all
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {/* Pre-flight Warnings */}
          {missingScreenshotsCount > 0 && (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <AlertDescription className="text-xs">
                <strong>Notice:</strong> {missingScreenshotsCount} of the selected screens will export with empty device frames.
              </AlertDescription>
            </Alert>
          )}

          {/* 1. Target Devices (iPhone 6.9" & iPad Pro 13") */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Target Devices
              </Label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXPORT_TARGETS.map((target) => {
                const isChecked = selectedTargetIds.includes(target.id);
                const IconComponent = target.category === "ipad" ? Tablet : Smartphone;
                return (
                  <Card
                    key={target.id}
                    onClick={() => toggleTarget(target.id)}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 p-3 shadow-none transition-all",
                      isChecked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/80 hover:bg-muted/40",
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleTarget(target.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <IconComponent className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-semibold leading-none truncate">
                            {target.name}
                          </span>
                        </div>
                        {target.badge && (
                          <Badge
                            variant={target.recommended ? "default" : "secondary"}
                            className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide shrink-0"
                          >
                            {target.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {target.description}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 2. Screens to Include (Moved ABOVE Locales) */}
          <Card className="space-y-2 bg-card/60 p-3 shadow-none border-border/80">
            <div className="flex items-center justify-between pb-1 border-b">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span>2. Screens to Include ({selectedSlideIds.length}/{slides.length})</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-[11px]"
                  onClick={selectAllSlides}
                >
                  Select all
                </Button>
                <span className="text-[11px] text-muted-foreground">•</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-[11px] text-muted-foreground"
                  onClick={deselectAllSlides}
                >
                  Deselect all
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 pt-1">
              {slides.map((slide, idx) => {
                const isChecked = selectedSlideIds.includes(slide.id);
                const isMissing = slide.layout !== "no-device" && !slide.screenshot;
                return (
                  <div
                    key={slide.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSlide(slide.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSlide(slide.id);
                      }
                    }}
                    aria-pressed={isChecked}
                    className={cn(
                      "flex h-auto cursor-pointer flex-col items-start gap-1 rounded-md border p-2 text-left text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isChecked
                        ? "border-primary/60 bg-primary/5 shadow-xs"
                        : "opacity-60 hover:opacity-100",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <span className="pointer-events-none">
                        <Checkbox checked={isChecked} tabIndex={-1} />
                      </span>
                    </div>
                    <span className="truncate text-xs font-medium capitalize">
                      {slide.layout.replace("-", " ")}
                    </span>
                    {isMissing && (
                      <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-500">
                        <AlertTriangle className="h-2.5 w-2.5" /> No screenshot
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 3. Locales & Folder Packaging Preset Row (Balanced & Compact) */}
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {/* Locales */}
            <Card className="flex flex-col space-y-2 bg-card/60 p-3 shadow-none border-border/80">
              <div className="flex items-center justify-between pb-1 border-b">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>3. Locales ({selectedLocales.length}/{locales.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px]"
                    onClick={selectAllLocales}
                  >
                    All
                  </Button>
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[11px] text-muted-foreground"
                    onClick={selectOnlyCurrentLocale}
                  >
                    Current only
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-wrap content-start gap-1.5 pt-1">
                {locales.map((loc) => {
                  const isChecked = selectedLocales.includes(loc);
                  return (
                    <Button
                      key={loc}
                      type="button"
                      variant={isChecked ? "default" : "outline"}
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => toggleLocale(loc)}
                      aria-pressed={isChecked}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      {getLocaleFlag(loc)} {getLocaleLabel(loc)}
                      <span className="font-mono text-[10px] uppercase opacity-80">
                        ({loc})
                      </span>
                    </Button>
                  );
                })}
              </div>
            </Card>

            {/* Packaging / Folder Structure (Radio Buttons) */}
            <Card className="space-y-2 bg-card/60 p-3 shadow-none border-border/80">
              <div className="flex items-center gap-1.5 pb-1 border-b text-xs font-semibold text-foreground">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <span>4. Folder Packaging Preset</span>
              </div>
              <RadioGroup
                value={folderPreset}
                onValueChange={(v) => setFolderPreset(v as FolderPreset)}
                className="gap-2 pt-1"
              >
                <div
                  onClick={() => setFolderPreset("standard")}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "standard"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="standard" id="preset-standard" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="preset-standard" className="cursor-pointer font-semibold text-xs leading-none">
                      Standard Store Layout
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Organized as <code>apple/iphone-6.9/en/01.png</code>
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setFolderPreset("fastlane")}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "fastlane"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="fastlane" id="preset-fastlane" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="preset-fastlane" className="cursor-pointer font-semibold text-xs leading-none">
                      Fastlane Deliver Preset
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Ready for automated CI/CD: <code>fastlane/screenshots/en/...</code>
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setFolderPreset("flat")}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "flat"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="flat" id="preset-flat" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="preset-flat" className="cursor-pointer font-semibold text-xs leading-none">
                      Flat ZIP Archive
                    </Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      All PNGs in a single root folder with prefixed filenames
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </Card>
          </div>
        </div>

        {/* Fixed Footer with Actions */}
        <DialogFooter className="shrink-0 flex flex-col gap-2 border-t bg-card/80 px-6 py-2.5 sm:flex-row sm:items-center sm:justify-end">
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
              disabled={isExportDisabled}
              onClick={handleExport}
              className="h-8 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export ({totalScreenshots} PNG{totalScreenshots === 1 ? "" : "s"})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
