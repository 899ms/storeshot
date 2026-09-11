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
  Play,
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  EXPORT_TARGETS,
  ExportConfig,
  FolderPreset,
} from "@/lib/export-options";
import type { StoreKind } from "@/lib/locale";
import { exportFolderForLocale, getLocaleFlag, getLocaleLabel } from "@/lib/locale";
import type { Slide } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: Slide[];
  locales: string[];
  currentLocale: string;
  onStartExport: (config: ExportConfig) => void;
  exporting: string | null;
  workspace: string | null;
};

const EXPORT_PREFS_KEY = "screenshots.export-prefs";
const FOLDER_PRESETS: FolderPreset[] = ["standard", "fastlane", "flat"];
const STORES: StoreKind[] = ["apple", "google"];

function loadExportPrefs(workspace: string | null): Record<string, unknown> {
  if (!workspace || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${EXPORT_PREFS_KEY}:${workspace}`);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((x): x is string => typeof x === "string");
  return list.length === value.length ? list : null;
}

export function ExportDialog({
  open,
  onOpenChange,
  slides,
  locales,
  currentLocale,
  onStartExport,
  exporting,
  workspace,
}: Props) {
  // Stored prefs for this workspace (each read is cheap; mount-only use).
  const storedPrefs = React.useMemo(() => loadExportPrefs(workspace), [workspace]);

  // Default selected targets: all targets marked defaultSelected
  const [selectedTargetIds, setSelectedTargetIds] = React.useState<string[]>(() => {
    const valid = new Set(EXPORT_TARGETS.map((t) => t.id));
    const saved = stringList(storedPrefs.selectedTargetIds)?.filter((id) => valid.has(id));
    return saved && saved.length > 0
      ? saved
      : EXPORT_TARGETS.filter((t) => t.defaultSelected).map((t) => t.id);
  });

  // Only store locales are exported: the "en"/"es" source languages are
  // never emitted, and folders follow the selected store's codes.
  const exportableLocales = React.useMemo(
    () => locales.filter((l) => exportFolderForLocale(l) !== null),
    [locales],
  );

  // Default selected locales: all project locales
  const [selectedLocales, setSelectedLocales] = React.useState<string[]>(() =>
    stringList(storedPrefs.selectedLocales) ?? locales.filter((l) => exportFolderForLocale(l) !== null),
  );

  // Default selected slides: all slides
  const [selectedSlideIds, setSelectedSlideIds] = React.useState<string[]>(() =>
    stringList(storedPrefs.selectedSlideIds) ?? slides.map((s) => s.id),
  );

  // Folder packaging preset
  const [folderPreset, setFolderPreset] = React.useState<FolderPreset>(() =>
    typeof storedPrefs.folderPreset === "string" &&
    (FOLDER_PRESETS as string[]).includes(storedPrefs.folderPreset)
      ? (storedPrefs.folderPreset as FolderPreset)
      : "standard",
  );

  // Target store: locale folder names follow App Store Connect or
  // Google Play codes (they differ, e.g. sl-SI vs sl).
  const [store, setStore] = React.useState<StoreKind>(() =>
    typeof storedPrefs.store === "string" && (STORES as string[]).includes(storedPrefs.store)
      ? (storedPrefs.store as StoreKind)
      : "apple",
  );

  // Adopt the new workspace's stored prefs on switch (without clobbering
  // them first); persist every change otherwise.
  const prefsWorkspaceRef = React.useRef<string | null>(workspace);
  React.useEffect(() => {
    if (!workspace) return;
    if (prefsWorkspaceRef.current !== workspace) {
      prefsWorkspaceRef.current = workspace;
      const valid = new Set(EXPORT_TARGETS.map((t) => t.id));
      const targets = stringList(storedPrefs.selectedTargetIds)?.filter((id) => valid.has(id));
      if (targets && targets.length > 0) setSelectedTargetIds(targets);
      if (
        typeof storedPrefs.folderPreset === "string" &&
        (FOLDER_PRESETS as string[]).includes(storedPrefs.folderPreset)
      ) {
        setFolderPreset(storedPrefs.folderPreset as FolderPreset);
      }
      if (typeof storedPrefs.store === "string" && (STORES as string[]).includes(storedPrefs.store)) {
        setStore(storedPrefs.store as StoreKind);
      }
      const savedLocales = stringList(storedPrefs.selectedLocales);
      if (savedLocales) setSelectedLocales(savedLocales);
      const savedSlides = stringList(storedPrefs.selectedSlideIds);
      if (savedSlides) setSelectedSlideIds(savedSlides);
      return;
    }
    try {
      window.localStorage.setItem(
        `${EXPORT_PREFS_KEY}:${workspace}`,
        JSON.stringify({ selectedTargetIds, selectedLocales, selectedSlideIds, folderPreset, store }),
      );
    } catch {
      // storage unavailable — prefs simply won't be restored
    }
  }, [workspace, storedPrefs, selectedTargetIds, selectedLocales, selectedSlideIds, folderPreset, store]);

  // Keep state synced when props change. Reopening reconciles with the
  // live deck: deleted slides/locales drop out, newly added ones join, so
  // header counts always match what the bundle will contain.
  React.useEffect(() => {
    if (!open) return;
    const allSlideIds = slides.map((s) => s.id);
    const slideSet = new Set(allSlideIds);
    setSelectedSlideIds((prev) => {
      const kept = prev.filter((id) => slideSet.has(id));
      const fresh = allSlideIds.filter((id) => !prev.includes(id));
      const next = [...kept, ...fresh];
      return next.length > 0 ? next : allSlideIds;
    });
    setSelectedLocales((prev) => {
      const kept = prev.filter((l) => exportableLocales.includes(l));
      const fresh = exportableLocales.filter((l) => !prev.includes(l));
      const next = [...kept, ...fresh];
      return next.length > 0 ? next : [...exportableLocales];
    });
  }, [open, locales, slides, exportableLocales]);

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

  const selectAllLocales = () => setSelectedLocales([...exportableLocales]);
  const selectOnlyCurrentLocale = () => {
    if (exportFolderForLocale(currentLocale) !== null) {
      setSelectedLocales([currentLocale]);
    } else if (exportableLocales.length > 0) {
      setSelectedLocales([exportableLocales[0]]);
    }
  };

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
  // Example upload folder for the selected store (labels differ per store).
  const exampleFolder = exportFolderForLocale("sl", store) ?? "sl";
  const storeName = store === "apple" ? "App Store" : "Google Play";

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
      store,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[60vh] h-[60vh] max-w-[calc(100vw-2rem)] overflow-hidden p-0 gap-0 sm:max-w-3xl">
        {/* Header with Top CTA */}
        <DialogHeader className="shrink-0 border-b px-6 py-3.5 bg-card/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                {store === "apple" ? (
                  <Apple className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold tracking-tight">
                  Export {storeName} Screenshots
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  Choose devices, screens, and packaging format for your {storeName} bundle.
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
                Recommended devices
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
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={isChecked}
                    aria-label={target.name}
                    onClick={() => toggleTarget(target.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleTarget(target.id);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 p-3 shadow-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isChecked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/80 hover:bg-muted/40",
                    )}
                  >
                    <span className="pointer-events-none mt-0.5" aria-hidden>
                      <Checkbox checked={isChecked} tabIndex={-1} />
                    </span>
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
                  <span>3. Locales ({selectedLocales.length}/{exportableLocales.length})</span>
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
                {exportableLocales.map((loc) => {
                  const isChecked = selectedLocales.includes(loc);
                  const folder = exportFolderForLocale(loc, store) ?? loc;
                  return (
                    <Button
                      key={loc}
                      type="button"
                      variant={isChecked ? "default" : "outline"}
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => toggleLocale(loc)}
                      aria-pressed={isChecked}
                      title={folder !== loc ? `Upload folder: ${folder}` : undefined}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      {getLocaleFlag(loc)} {getLocaleLabel(loc)}
                      <span className="font-mono text-[10px] uppercase opacity-80">
                        ({folder})
                      </span>
                    </Button>
                  );
                })}
                {exportableLocales.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No exportable locales — add an App Store locale such as en-US in
                    Settings → Locales. The en source language is never exported.
                  </p>
                )}
              </div>
              {exportableLocales.length < locales.length && (
                <p className="text-[10px] text-muted-foreground">
                  Source languages (en, es) are never exported — use regional
                  variants such as en-US or es-ES instead.
                </p>
              )}
            </Card>

            {/* Packaging / Folder Structure (Radio Buttons) */}
            <Card className="space-y-2 bg-card/60 p-3 shadow-none border-border/80">
              <div className="flex items-center justify-between gap-2 pb-1 border-b">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span>4. Folder Packaging Preset</span>
                </div>
                <div title="Locale folder names follow the selected store's codes">
                  <SegmentedControl
                    label="Target store"
                    layout="inline"
                    value={store}
                    onChange={(v) => setStore(v)}
                    options={[
                      { value: "apple", label: "App Store" },
                      { value: "google", label: "Google Play" },
                    ]}
                  />
                </div>
              </div>
              <RadioGroup
                value={folderPreset}
                onValueChange={(v) => setFolderPreset(v as FolderPreset)}
                className="gap-2 pt-1"
              >
                <label
                  htmlFor="preset-standard"
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "standard"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="standard" id="preset-standard" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs leading-none">
                      Standard Store Layout
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Organized as <code>apple/iphone-6.9/{exampleFolder}/01.png</code>
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="preset-fastlane"
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "fastlane"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="fastlane" id="preset-fastlane" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs leading-none">
                      Fastlane Deliver Preset
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Ready for automated CI/CD: <code>fastlane/screenshots/{exampleFolder}/...</code>
                    </p>
                  </div>
                </label>

                <label
                  htmlFor="preset-flat"
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border p-2 text-xs transition-colors",
                    folderPreset === "flat"
                      ? "border-primary bg-primary/5"
                      : "border-border/70 hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="flat" id="preset-flat" className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-xs leading-none">
                      Flat ZIP Archive
                    </span>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      All PNGs in a single root folder with prefixed filenames
                    </p>
                  </div>
                </label>
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
