"use client";
import * as React from "react";
import { Check, FlaskConical, Globe, KeyRound, Languages, Loader2, Plus, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  countPendingUnits,
  translateSlidesForLocale,
  TranslateError,
  type SlideTranslation,
  type TranslateCall,
} from "@/lib/translate";
import type { Slide } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  currentLocale: string;
  sourceLocale: string;
  slides: Slide[];
  disabled?: boolean;
  onAddLocale: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onApplyTranslations: (
    targetLocale: string,
    results: Record<string, SlideTranslation>,
    overwrite: boolean,
  ) => void;
};

export function SettingsDialog({
  open,
  onOpenChange,
  locales,
  currentLocale,
  sourceLocale,
  slides,
  disabled,
  onAddLocale,
  onRemoveLocale,
  onApplyTranslations,
}: Props) {
  const { settings, setSettings, patchProvider, addProvider, removeProvider } =
    useAppSettings();
  const call: TranslateCall = {
    baseUrl: activeProvider(settings).baseUrl,
    apiKey: activeProvider(settings).apiKey,
    model: settings.model,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-2xl flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base font-bold">Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Providers, model, and project languages. API keys stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="providers" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-6 pt-3">
            <TabsList className="h-8">
              <TabsTrigger value="providers" className="gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Providers
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-1.5 text-xs">
                Model
              </TabsTrigger>
              <TabsTrigger value="locales" className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" /> Locales ({locales.length})
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="providers" className="mt-0 space-y-3">
              <ProvidersTab
                settings={settings}
                onSelect={(id) => setSettings((p) => ({ ...p, activeProviderId: id }))}
                onPatch={patchProvider}
                onAdd={addProvider}
                onRemove={removeProvider}
              />
            </TabsContent>
            <TabsContent value="model" className="mt-0 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Model slug</Label>
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
            <TabsContent value="locales" className="mt-0 space-y-3">
              <LocalesTab
                locales={locales}
                currentLocale={currentLocale}
                sourceLocale={sourceLocale}
                slides={slides}
                call={call}
                disabled={disabled}
                onAdd={onAddLocale}
                onRemove={onRemoveLocale}
                onApply={onApplyTranslations}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
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

type LocaleStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "done"; count: number }
  | { state: "error"; error: string };

function LocalesTab({
  locales,
  currentLocale,
  sourceLocale,
  slides,
  call,
  disabled,
  onAdd,
  onRemove,
  onApply,
}: {
  locales: string[];
  currentLocale: string;
  sourceLocale: string;
  slides: Slide[];
  call: TranslateCall;
  disabled?: boolean;
  onAdd: (locale: string) => void;
  onRemove: (locale: string) => void;
  onApply: (
    targetLocale: string,
    results: Record<string, SlideTranslation>,
    overwrite: boolean,
  ) => void;
}) {
  const available = React.useMemo(
    () => Object.keys(LOCALE_NAMES).filter((l) => !locales.includes(l)).sort(),
    [locales],
  );
  const [pending, setPending] = React.useState<string>("");
  const [overwrite, setOverwrite] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<string, LocaleStatus>>({});
  const [bulkRunning, setBulkRunning] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (pending && !available.includes(pending)) setPending("");
  }, [pending, available]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const missingKey = !call.apiKey;
  const targets = locales.filter((l) => l !== sourceLocale);

  async function runOne(targetLocale: string, signal: AbortSignal): Promise<number> {
    setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "running" } }));
    try {
      const results = await translateSlidesForLocale(call, slides, sourceLocale, targetLocale, {
        overwrite,
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
      onApply(targetLocale, results, overwrite);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "done", count } }));
      return count;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "idle" } }));
        throw e;
      }
      const error = e instanceof TranslateError ? e.message : String(e);
      setStatuses((prev) => ({ ...prev, [targetLocale]: { state: "error", error } }));
      return 0;
    }
  }

  async function runAll() {
    if (bulkRunning) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBulkRunning(true);
    try {
      for (const target of targets) {
        if (controller.signal.aborted) break;
        try {
          await runOne(target, controller.signal);
        } catch {
          break; // aborted
        }
      }
    } finally {
      abortRef.current = null;
      setBulkRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {locales.map((loc) => (
            <span
              key={loc}
              className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs"
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
              {loc === sourceLocale && (
                <Badge variant="outline" className="px-1 py-0 text-[9px]">
                  source
                </Badge>
              )}
              {locales.length > 1 && (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  onClick={() => onRemove(loc)}
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
        {available.length > 0 && (
          <div className="flex gap-2">
            <Select value={pending} onValueChange={setPending} disabled={disabled}>
              <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Add language">
                <SelectValue placeholder="Add a language…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {available.map((l) => (
                  <SelectItem key={l} value={l}>
                    {getLocaleFlag(l)} {getLocaleLabel(l)} ({l})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!pending || disabled}
              onClick={() => {
                if (pending) {
                  onAdd(pending);
                  setPending("");
                }
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Removing a language keeps its saved texts in the project file but hides it from the
          editor and exports.
        </p>
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" />
            Translate from {getLocaleFlag(sourceLocale)} {sourceLocale}
          </h4>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
              <Checkbox
                checked={overwrite}
                onCheckedChange={(v) => setOverwrite(v === true)}
                disabled={disabled || bulkRunning}
              />
              Overwrite existing
            </label>
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
                    ? "Add an API key in the Providers tab first"
                    : "Translate all missing texts"
                }
              >
                <Languages className="h-3 w-3" /> Translate all missing
              </Button>
            )}
          </div>
        </div>
        {missingKey && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Add an API key in the Providers tab to enable translation.
          </p>
        )}
        <div className="space-y-1.5">
          {targets.map((target) => {
            const status = statuses[target] || { state: "idle" as const };
            const pendingCount = countPendingUnits(slides, sourceLocale, target);
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
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" /> {status.count} translated
                  </span>
                )}
                {status.state === "error" && (
                  <span className="max-w-56 shrink-0 truncate text-[11px] text-destructive" title={status.error}>
                    {status.error}
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
                  ) : pendingCount === 0 ? (
                    "Up to date"
                  ) : (
                    `Translate (${pendingCount})`
                  )}
                </Button>
              </div>
            );
          })}
          {targets.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Add another language above to enable translation.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
