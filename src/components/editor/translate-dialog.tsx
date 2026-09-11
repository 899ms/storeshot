"use client";
import * as React from "react";
import { AlertTriangle, Check, Languages, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { activeProvider, useAppSettings } from "@/lib/app-settings";
import { DEFAULT_LOCALE, getLocaleFlag, getLocaleLabel } from "@/lib/locale";
import { reportError } from "@/lib/error-log";
import {
  translateSlidesForLocale,
  countSentUnits,
  findSourceSkips,
  TranslateError,
  type SlideTranslation,
} from "@/lib/translate";
import type { Device, Slide } from "@/lib/types";

type LocaleStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; count: number; missing?: number }
  | { state: "error"; error: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  slides: Slide[];
  device: Device;
  sourceLocale?: string;
  disabled?: boolean;
  onApplyTranslations: (
    targetLocale: string,
    results: Record<string, SlideTranslation>,
    overwrite: boolean,
    originDevice: Device,
  ) => void;
};

export function TranslateDialog({
  open,
  onOpenChange,
  locales,
  slides,
  device,
  sourceLocale = DEFAULT_LOCALE,
  disabled,
  onApplyTranslations,
}: Props) {
  const { settings } = useAppSettings();
  const call = {
    baseUrl: activeProvider(settings).baseUrl,
    apiKey: activeProvider(settings).apiKey,
    model: settings.model,
  };
  // Locales translate 5 at a time; each locale still chunks slides by 10
  // inside translateSlidesForLocale.
  const CONCURRENT_LOCALES = 5;
  const [statuses, setStatuses] = React.useState<Record<string, LocaleStatus>>({});
  const [bulkRunning, setBulkRunning] = React.useState(false);
  // Independent controllers: bulk Stop must never kill (or be stolen by)
  // per-row single runs.
  const bulkAbortRef = React.useRef<AbortController | null>(null);
  const singleAbortsRef = React.useRef(new Map<string, AbortController>());

  React.useEffect(() => {
    const bulk = bulkAbortRef.current;
    const singles = singleAbortsRef.current;
    return () => {
      bulk?.abort();
      singles.forEach((c) => c.abort());
    };
  }, []);

  const missingKey = !call.apiKey;
  const targets = locales.filter((l) => l !== sourceLocale);

  async function runOne(
    targetLocale: string,
    signal: AbortSignal,
  ): Promise<{ ok: true; missing: number } | { ok: false; error: string }> {
    // Pin the origin deck + slide ids at invocation: a device switch or
    // delete/reorder mid-run must not misapply results to another deck.
    // (The editor prunes results to ids still present and reports drops.)
    const originDevice = device;
    setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "running" } }));
    try {
      const results = await translateSlidesForLocale(call, slides, sourceLocale, targetLocale, {
        overwrite: true,
        signal,
      });
      const count = Object.values(results).reduce(
        (n, r) =>
          n +
          (r.label !== undefined ? 1 : 0) +
          (r.headline !== undefined ? 1 : 0) +
          Object.keys(r.texts || {}).length,
        0,
      );
      const sent = countSentUnits(slides, sourceLocale, targetLocale);
      const missing = Math.max(0, sent - count);
      if (sent > 0 && count === 0) {
        const error = "Model returned no usable translations";
        setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "error", error } }));
        return { ok: false, error };
      }
      onApplyTranslations(targetLocale, results, true, originDevice);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "done", count, missing } }));
      return { ok: true, missing };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "idle" } }));
        throw e;
      }
      const error = e instanceof TranslateError ? e.message : String(e);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "error", error } }));
      return { ok: false, error };
    }
  }

  async function runAll() {
    if (bulkRunning) return;
    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setBulkRunning(true);
    const outcomes = new Map<string, { ok: true; missing: number } | { ok: false; error: string }>();
    try {
      const queue = [...targets];
      async function runWorker() {
        while (queue.length > 0) {
          if (controller.signal.aborted) break;
          const target = queue.shift();
          if (!target) break;
          try {
            outcomes.set(target, await runOne(target, controller.signal));
          } catch {
            if (controller.signal.aborted) break;
            // aborts re-throw from runOne; per-locale errors return { ok: false }
          }
        }
      }
      const workers = Array.from(
        { length: Math.min(CONCURRENT_LOCALES, queue.length) },
        () => runWorker(),
      );
      await Promise.allSettled(workers);
    } finally {
      if (bulkAbortRef.current === controller) bulkAbortRef.current = null;
      setBulkRunning(false);
    }
    if (controller.signal.aborted) return;
    // Dialog may be closed while this ran — toast so the result is visible.
    const okEntries = [...outcomes.values()].filter(
      (v): v is { ok: true; missing: number } => v.ok,
    );
    const failures = [...outcomes.entries()].filter(
      (entry): entry is [string, { ok: false; error: string }] => !entry[1].ok,
    );
    const partial = okEntries.reduce((n, v) => n + v.missing, 0);
    if (failures.length > 0) {
      reportError(
        "translate",
        `${failures.length} of ${targets.length} locales failed to translate`,
        failures
          .slice(0, 5)
          .map(([locale, result]) => `${locale}: ${result.error}`)
          .join("\n"),
      );
    }
    if (failures.length === 0 && targets.length > 0) {
      const skipped = findSourceSkips(slides, sourceLocale).length;
      if (partial > 0) {
        toast.warning(
          `Translated ${okEntries.length} locale${okEntries.length === 1 ? "" : "s"} with ${partial} missing string${partial === 1 ? "" : "s"} — check rows`,
        );
      } else {
        toast.success(
          `Translated ${okEntries.length} locale${okEntries.length === 1 ? "" : "s"}`,
          {
            description:
              skipped > 0
                ? `${skipped} field${skipped === 1 ? "" : "s"} skipped (no ${sourceLocale} source text)`
                : undefined,
          },
        );
      }
    } else if (okEntries.length > 0) {
      toast.warning(`Translated ${okEntries.length} of ${targets.length} locales — check errors`);
    } else if (targets.length > 0) {
      toast.error("Translation failed — check errors");
    }
  }

  async function runSingle(targetLocale: string) {
    const existing = singleAbortsRef.current.get(targetLocale);
    if (existing) return;
    const controller = new AbortController();
    singleAbortsRef.current.set(targetLocale, controller);
    try {
      await runOne(targetLocale, controller.signal);
    } catch {
      // Aborts re-throw; status already reset to idle in runOne.
    } finally {
      if (singleAbortsRef.current.get(targetLocale) === controller) {
        singleAbortsRef.current.delete(targetLocale);
      }
    }
  }

  const doneCount = targets.filter((t) => statuses[t]?.state === "done").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 gap-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
            <Languages className="h-4 w-4 text-muted-foreground" /> Translate
          </DialogTitle>
          <DialogDescription className="text-xs">
            AI translation from {getLocaleFlag(sourceLocale)} {getLocaleLabel(sourceLocale)} to
            all added locales. Uses your API key — keys stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold">
              Batch translate to all added locales · from {getLocaleFlag(sourceLocale)}{" "}
              {sourceLocale}
              {bulkRunning && (
                <span role="status" aria-live="polite" className="font-normal text-muted-foreground">
                  · {doneCount}/{targets.length}
                </span>
              )}
            </h4>
            <div className="ml-auto flex items-center gap-2">
              {bulkRunning ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  onClick={() => bulkAbortRef.current?.abort()}
                >
                  <Square className="h-3 w-3 fill-current" /> Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 text-[11px]"
                  disabled={disabled || missingKey || targets.length === 0}
                  onClick={() => void runAll()}
                  title={
                    missingKey
                      ? "Add your OpenRouter API key in Settings → Providers first, then press Test"
                      : "Translate every screen to every added locale"
                  }
                >
                  <Languages className="h-3 w-3" /> Translate all locales
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Uses your API key ({call.baseUrl}) with model{" "}
            <code className="font-mono">{call.model || "—"}</code>. Keys stay in this
            browser only.
          </p>
          {missingKey && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Add your OpenRouter API key in Settings → Providers (then Test) to enable
              translation.
            </p>
          )}
          {bulkRunning && (
            <p className="text-[11px] text-muted-foreground">
              You can close this dialog — translation keeps running in the background.
              Reopen to check progress or stop.
            </p>
          )}
          <div className="space-y-1.5">
            {targets.map((target) => {
              const status = statuses[target] || { state: "idle" as const };
              return (
                <div
                  key={target}
                  className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {getLocaleFlag(target)} {getLocaleLabel(target)}{" "}
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      ({target})
                    </span>
                  </span>
                  {status.state === "done" && (status.missing ?? 0) === 0 && (
                    <span
                      className="flex shrink-0 items-center text-green-600 dark:text-green-400"
                      title={`${status.count} strings translated`}
                      aria-label={`${status.count} strings translated`}
                      role="img"
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  {status.state === "done" && (status.missing ?? 0) > 0 && (
                    <span
                      className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
                      title={`${status.count} strings translated, ${status.missing} missing from model response`}
                    >
                      <AlertTriangle className="h-4 w-4" /> {status.count} · {status.missing} missing
                    </span>
                  )}
                  {status.state === "error" && (
                    <span
                      className="flex shrink-0 items-center text-destructive"
                      title={status.error}
                      aria-label={`Translation failed: ${status.error}`}
                      role="img"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-[11px]"
                    disabled={disabled || missingKey || status.state === "running" || bulkRunning}
                    onClick={() => void runSingle(target)}
                  >
                    {status.state === "running" ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Translating…
                      </span>
                    ) : (
                      "Translate"
                    )}
                  </Button>
                </div>
              );
            })}
            {targets.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Add another language in Settings → Locales to enable translation.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
