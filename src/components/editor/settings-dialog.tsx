"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, FlaskConical, Globe, KeyRound, Plus, Trash2, Type } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  activeProvider,
  testProviderConnection,
  useAppSettings,
  type ProviderConfig,
} from "@/lib/app-settings";
import { getLocaleFlag, getLocaleLabel, LOCALE_NAMES } from "@/lib/locale";
import { CURATED_FONTS, ensureFontLoaded, fontStack } from "@/lib/fonts";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locales: string[];
  currentLocale: string;
  headlineFont: string;
  labelFont: string;
  disabled?: boolean;
  onAddLocale: (locale: string) => void;
  onRemoveLocale: (locale: string) => void;
  onHeadlineFontChange: (family: string) => void;
  onLabelFontChange: (family: string) => void;
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
  disabled,
  onAddLocale,
  onRemoveLocale,
  onHeadlineFontChange,
  onLabelFontChange,
  onSelectLocale,
  initialTab,
}: Props) {
  const { settings, setSettings, patchProvider, addProvider, removeProvider } =
    useAppSettings();
  // Controlled tab so callers (e.g. the toolbar locale menu) can open the
  // dialog directly on a specific tab. Synced on open only, so tab switches
  // inside an open dialog are never overridden.
  const [tab, setTab] = React.useState(initialTab ?? "providers");
  React.useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 gap-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-base font-bold">Settings</DialogTitle>
          <DialogDescription className="text-xs">
            Providers, model, fonts, and project languages. API keys stay in this browser only.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-6 pt-3">
            <TabsList className="h-8">
              <TabsTrigger value="providers" className="gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> Providers
              </TabsTrigger>
              <TabsTrigger value="model" className="gap-1.5 text-xs">
                Model
              </TabsTrigger>
              <TabsTrigger value="fonts" className="gap-1.5 text-xs">
                <Type className="h-3.5 w-3.5" /> Fonts
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
            <TabsContent value="fonts" className="mt-0 space-y-4">
              <FontsTab
                headlineFont={headlineFont}
                labelFont={labelFont}
                disabled={disabled}
                onHeadlineFontChange={onHeadlineFontChange}
                onLabelFontChange={onLabelFontChange}
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

function FontsTab({
  headlineFont,
  labelFont,
  disabled,
  onHeadlineFontChange,
  onLabelFontChange,
}: {
  headlineFont: string;
  labelFont: string;
  disabled?: boolean;
  onHeadlineFontChange: (family: string) => void;
  onLabelFontChange: (family: string) => void;
}) {
  // Preview fonts load lazily per visible row (see FontRow) instead of all
  // 30 families up front.
  return (
    <div className="space-y-4">
      <FontPicker
        label="Headline"
        hint="Big multi-line headline on each screen"
        value={headlineFont}
        disabled={disabled}
        onSelect={onHeadlineFontChange}
      />
      <FontPicker
        label="Label"
        hint="Small title above the headline + overlay texts"
        value={labelFont}
        disabled={disabled}
        onSelect={onLabelFontChange}
      />
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
