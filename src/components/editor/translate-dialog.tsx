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
import {
  translateSlidesForLocale,
  TranslateError,
  type SlideTranslation,
} from "@/lib/translate";
import type { Slide } from "@/lib/types";

type LocaleStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; count: number }
  | { state: "error"; error: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  slides: Slide[];
  sourceLocale?: string;
  disabled?: boolean;
  onApplyTranslations: (
    targetLocale: string,
    results: Record<string, SlideTranslation>,
    overwrite: boolean,
  ) => void;
};

export function TranslateDialog({
  open,
  onOpenChange,
  locales,
  slides,
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
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const missingKey = !call.apiKey;
  const targets = locales.filter((l) => l !== sourceLocale);

  async function runOne(targetLocale: string, signal: AbortSignal): Promise<"ok" | "error"> {
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
      onApplyTranslations(targetLocale, results, true);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "done", count } }));
      return "ok";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "idle" } }));
        throw e;
      }
      const error = e instanceof TranslateError ? e.message : String(e);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "error", error } }));
      return "error";
    }
  }

  async function runAll() {
    if (bulkRunning) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBulkRunning(true);
    const outcomes = new Map<string, "ok" | "error">();
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
            // aborts re-throw from runOne; per-locale errors return "error"
          }
        }
      }
      const workers = Array.from(
        { length: Math.min(CONCURRENT_LOCALES, queue.length) },
        () => runWorker(),
      );
      await Promise.allSettled(workers);
    } finally {
      abortRef.current = null;
      setBulkRunning(false);
    }
    if (controller.signal.aborted) return;
    // Dialog may be closed while this ran — toast so the result is visible.
    const ok = [...outcomes.values()].filter((v) => v === "ok").length;
    if (ok === targets.length && targets.length > 0) {
      toast.success(`Translated ${ok} locale${ok === 1 ? "" : "s"}`);
    } else if (ok > 0) {
      toast.warning(`Translated ${ok} of ${targets.length} locales — check errors`);
    } else if (targets.length > 0) {
      toast.error("Translation failed — check errors");
    }
  }

  const doneCount = targets.filter((t) => statuses[t]?.state === "done").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-2xl flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
            <Languages className="h-4 w-4 text-muted-foreground" /> Translate
          </DialogTitle>
          <DialogDescription className="text-xs">
            AI translation from {getLocaleFlag(sourceLocale)} {sourceLocale} (English) to all
            added locales. Uses your API key — keys stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold">
              Batch translate to all added locales · from {getLocaleFlag(sourceLocale)}{" "}
              {sourceLocale}
              {bulkRunning && (
                <span className="font-normal text-muted-foreground">
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
                  onClick={() => abortRef.current?.abort()}
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
                  <Languages className="h-3 w-3" /> Translate all
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
                  {status.state === "done" && (
                    <span
                      className="flex shrink-0 items-center text-green-600 dark:text-green-400"
                      title={`${status.count} strings translated`}
                      aria-label={`${status.count} strings translated`}
                      role="img"
                    >
                      <Check className="h-4 w-4" />
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
                    onClick={() => {
                      const controller = new AbortController();
                      abortRef.current = controller;
                      void runOne(target, controller.signal).finally(() => {
                        if (abortRef.current === controller) abortRef.current = null;
                      });
                    }}
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
