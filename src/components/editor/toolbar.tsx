"use client";
import * as React from "react";
import { AlertTriangle, ArrowUp, Bug, Check, ChevronRight, Cloud, Download, Folder, FolderOpen, Home, Languages, Loader2, RotateCcw, Save, Settings, Smartphone, Square, Tablet, UnfoldHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getActiveWorkspace,
  getRecentWorkspaces,
  removeRecentWorkspace,
  setActiveWorkspace,
  touchRecentWorkspace,
  useActiveWorkspace,
  workspaceName,
} from "@/lib/workspaces";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEVICE_LABEL } from "@/lib/constants";
import { getLocaleFlag, getLocaleLabel } from "@/lib/locale";
import type { Device } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";

type Props = {
  appName: string;
  setAppName: (v: string) => void;
  connectedCanvas: boolean;
  setConnectedCanvas: (v: boolean) => void;
  locale: string;
  setLocale: (v: string) => void;
  locales: string[];
  device: Device;
  setDevice?: (v: Device) => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenTranslate: () => void;
  onStopExport?: () => void;
  onResetAll: () => void;
  onResetDevice?: () => void;
  exporting: string | null;
  savedAt: number | null;
  saveError: string | null;
  saving: boolean;
  onSave: () => void;
  errorCount: number;
  onOpenErrorLog: () => void;
  translatableCount: number;
  translatingLocale: boolean;
  canTranslateLocale: boolean;
  onTranslateLocale: () => void;
  busy: boolean;
};

export function Toolbar(props: Props) {
  const [resetOpen, setResetOpen] = React.useState(false);
  const showLocale = props.locales.length > 1;
  const deviceLabel = DEVICE_LABEL[props.device] ?? "iPhone";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b bg-card/40 px-4 py-2">
      <WorkspaceSwitcher disabled={props.busy} />
      <Input
        value={props.appName}
        onChange={(e) => props.setAppName(e.target.value)}
        className="h-8 w-40 border-dashed text-sm font-semibold focus-visible:border-input focus-visible:border-solid focus-visible:bg-background"
        placeholder="App name"
        aria-label="App name"
        title="App name (click to edit)"
        disabled={props.busy}
      />

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button
        type="button"
        variant={props.connectedCanvas ? "secondary" : "outline"}
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => props.setConnectedCanvas(!props.connectedCanvas)}
        aria-pressed={props.connectedCanvas}
        title={
          props.connectedCanvas
            ? "Connected canvas enabled"
            : "Isolated screens; turn on to let elements cross screen edges"
        }
        disabled={props.busy}
      >
        <UnfoldHorizontal className="h-3.5 w-3.5" />
        {props.connectedCanvas ? "Connected" : "Isolated"}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {props.setDevice ? (
        <Select
          value={props.device}
          onValueChange={(v) => props.setDevice?.(v as Device)}
          disabled={props.busy}
        >
          <SelectTrigger className="h-8 w-36 text-xs" aria-label="Device">
            <SelectValue placeholder="Device" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="iphone">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                iPhone 6.9&Prime;
              </span>
            </SelectItem>
            <SelectItem value="ipad">
              <span className="flex items-center gap-1.5">
                <Tablet className="h-3.5 w-3.5 text-muted-foreground" />
                iPad 13&Prime;
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {showLocale && (
        <>
        <Select value={props.locale} onValueChange={props.setLocale} disabled={props.busy}>
          <SelectTrigger className="h-8 w-44 text-xs" aria-label="Language">
            <SelectValue placeholder="Language">
              {getLocaleFlag(props.locale)} {getLocaleLabel(props.locale)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {props.locales.map((l) => (
              <SelectItem key={l} value={l}>
                {getLocaleFlag(l)} {getLocaleLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {props.locale !== "en" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={props.onTranslateLocale}
            title={`Translate all ${props.translatableCount} screens from English to ${props.locale} (overwrites existing)`}
            aria-label={`Translate locale ${props.locale} (${props.translatableCount} screens)`}
            disabled={
              props.busy ||
              props.translatingLocale ||
              !props.canTranslateLocale ||
              props.translatableCount === 0
            }
          >
            {props.translatingLocale ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {props.translatingLocale
                ? "Translating…"
                : `Translate locale (${props.locale})`}
            </span>
          </Button>
        )}
        <span className="sr-only" role="status">
          {props.translatingLocale ? `Translating screens to ${props.locale}…` : ""}
        </span>
        </>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SaveStatus savedAt={props.savedAt} saveError={props.saveError} saving={props.saving} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={props.onSave}
          title="Save now (Cmd/Ctrl+S)"
          aria-label="Save now"
          disabled={props.busy || props.saving}
        >
          {props.saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          onClick={props.onOpenErrorLog}
          title={props.errorCount > 0 ? `Error log (${props.errorCount} unread)` : "Error log"}
          aria-label={props.errorCount > 0 ? `Error log, ${props.errorCount} unread` : "Error log"}
        >
          <Bug className="h-4 w-4" />
          {props.errorCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold tabular-nums text-destructive-foreground">
              {props.errorCount > 99 ? "99+" : props.errorCount}
            </span>
          )}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <ThemeToggle disabled={props.busy} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={props.onOpenTranslate}
          title="Translate all screens to all added locales"
          aria-label="Translate all locales"
          disabled={props.busy}
        >
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline">Translate All</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={props.onOpenSettings}
          title="Settings (providers, model, languages)"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setResetOpen(true)}
          title="Reset screens to defaults"
          aria-label="Reset"
          disabled={props.busy}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {props.exporting ? (
          <Button
            onClick={props.onStopExport}
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs font-semibold"
            title="Stop export process"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={props.onExport}
            size="sm"
            className="h-8 gap-1.5"
            title={`Export ${deviceLabel} App Store screenshot bundle as zip`}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        )}
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset your {deviceLabel} screens to defaults? Your canvas edits, uploaded screenshots, and copy will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                props.onResetAll();
              }}
            >
              Reset screens
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkspaceSwitcher({ disabled }: { disabled?: boolean }) {
  const active = useActiveWorkspace();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [browsePath, setBrowsePath] = React.useState("");
  const [browseParent, setBrowseParent] = React.useState<string | null>(null);
  const [browseHome, setBrowseHome] = React.useState("");
  const [browseAppRoot, setBrowseAppRoot] = React.useState("");
  const [entries, setEntries] = React.useState<
    { name: string; path: string; hasProject: boolean }[]
  >([]);
  const [browseLoading, setBrowseLoading] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const loadDir = React.useCallback(async (dir?: string) => {
    setBrowseLoading(true);
    setError(null);
    try {
      const url = dir
        ? `/api/workspaces/browse?path=${encodeURIComponent(dir)}`
        : "/api/workspaces/browse";
      const resp = await fetch(url);
      const json = (await resp.json()) as {
        ok: boolean;
        path?: string;
        parent?: string | null;
        home?: string;
        appRoot?: string;
        entries?: { name: string; path: string; hasProject: boolean }[];
        error?: string;
      };
      if (!json.ok || !json.path) {
        setError(json.error || "Could not list folder");
        return;
      }
      setBrowsePath(json.path);
      setBrowseParent(json.parent ?? null);
      if (json.home) setBrowseHome(json.home);
      if (json.appRoot) setBrowseAppRoot(json.appRoot);
      setEntries(json.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  async function createFolder() {
    const name = newName.trim();
    if (!name || !browsePath) return;
    setError(null);
    try {
      const resp = await fetch("/api/workspaces/browse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ parent: browsePath, name }),
      });
      const json = (await resp.json()) as { ok: boolean; path?: string; error?: string };
      if (!json.ok || !json.path) {
        setError(json.error || "Could not create folder");
        return;
      }
      setNewName("");
      await loadDir(json.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const refresh = React.useCallback(() => setRecents(getRecentWorkspaces()), []);

  const openBrowser = React.useCallback(
    (initialDir?: string) => {
      setNewName("");
      setError(null);
      setOpenDialog(true);
      void loadDir(initialDir);
    },
    [loadDir],
  );

  // The workspace gate (shown when no workspace is active) opens this dialog.
  React.useEffect(() => {
    const handler = (e: Event) => {
      const dir = (e as CustomEvent<string | undefined>).detail;
      setMenuOpen(false);
      openBrowser(dir);
    };
    window.addEventListener("open-workspace-dialog", handler);
    return () => window.removeEventListener("open-workspace-dialog", handler);
  }, [openBrowser]);

  async function openPath(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("Enter a folder path");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const resp = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: trimmed }),
      });
      const json = (await resp.json()) as { ok: boolean; path?: string; error?: string };
      if (!json.ok || !json.path) {
        setError(json.error || "Could not open workspace");
        return;
      }
      touchRecentWorkspace(json.path);
      setActiveWorkspace(json.path);
      refresh();
      setOpenDialog(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (open) refresh();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-48 gap-1.5 px-2 text-xs"
            title={active ? `Workspace: ${active}` : "Choose a workspace folder"}
            disabled={disabled}
          >
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{workspaceName(active)}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {recents.map((ws) => (
            <div
              key={ws}
              title={ws}
              className="flex w-full items-center gap-1 px-2 py-1.5 text-xs hover:bg-muted/60 focus-within:bg-muted/60"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => {
                  // Re-validate before switching; drop dead entries.
                  void (async () => {
                    try {
                      const resp = await fetch("/api/workspaces", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ path: ws }),
                      });
                      const json = (await resp.json()) as {
                        ok: boolean;
                        path?: string;
                        error?: string;
                      };
                      if (!json.ok || !json.path) {
                        removeRecentWorkspace(ws);
                        refresh();
                        return;
                      }
                      touchRecentWorkspace(json.path);
                      setActiveWorkspace(json.path);
                      refresh();
                      setMenuOpen(false);
                    } catch {
                      removeRecentWorkspace(ws);
                      refresh();
                    }
                  })();
                }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {workspaceName(ws)}
                </span>
                {getActiveWorkspace() === ws && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title={`Remove ${workspaceName(ws)} from the list (files are kept)`}
                aria-label={`Remove ${workspaceName(ws)} from the list`}
                onClick={() => {
                  removeRecentWorkspace(ws);
                  if (getActiveWorkspace() === ws) setActiveWorkspace(null);
                  refresh();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {recents.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={() => {
              openBrowser(active ?? undefined);
            }}
          >
            <span className="flex w-full items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Open folder…
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Open workspace folder</DialogTitle>
            <DialogDescription>
              Pick the folder for this app — the project file and uploaded images are saved
              inside it. Folders marked <strong>workspace</strong> already contain a project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={!browseParent || browseLoading}
                onClick={() => browseParent && void loadDir(browseParent)}
                title="Go up"
                aria-label="Go up one folder"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" title={browsePath}>
                {browsePath || "…"}
              </p>
              {browseHome && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                  onClick={() => void loadDir(browseHome)}
                  title="Go to home folder"
                >
                  <Home className="h-3 w-3" /> Home
                </Button>
              )}
              {browseAppRoot && browseAppRoot !== browseHome && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-[11px]"
                  onClick={() => void loadDir(browseAppRoot)}
                  title="Go to the app folder"
                >
                  App
                </Button>
              )}
            </div>
            <div className="max-h-64 min-h-32 overflow-y-auto rounded-md border">
              {browseLoading ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No subfolders here.
                </p>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60"
                    onClick={() => void loadDir(entry.path)}
                    title={entry.path}
                  >
                    <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
                    {entry.hasProject && (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        workspace
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createFolder();
                }}
                placeholder="New folder name…"
                aria-label="New folder name"
                spellCheck={false}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-[11px]"
                disabled={!newName.trim() || !browsePath}
                onClick={() => void createFolder()}
              >
                Create
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void openPath(browsePath)}
              disabled={pending || !browsePath}
            >
              {pending ? "Opening…" : "Use this folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaveStatus({ savedAt, saveError, saving }: { savedAt: number | null; saveError: string | null; saving: boolean }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (saving) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  }

  if (saveError) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-destructive"
        title={saveError}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Save Failed
      </span>
    );
  }

  if (!savedAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Cloud className="h-3.5 w-3.5" /> Not Saved Yet
      </span>
    );
  }
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  const label =
    seconds < 5
      ? "Saved"
      : seconds < 60
        ? `Saved ${seconds}s Ago`
        : seconds < 3600
          ? `Saved ${Math.round(seconds / 60)}m Ago`
          : `Saved ${Math.round(seconds / 3600)}h Ago`;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-green-500" /> {label}
    </span>
  );
}
