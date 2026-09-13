"use client";
import * as React from "react";
import { ArrowUp, Check, ChevronRight, Folder, FolderOpen, FolderSearch, Home, X } from "lucide-react";
import { revealPath } from "@/lib/native";
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

export function WorkspaceSwitcher({
  disabled,
  dialogOnly,
}: {
  disabled?: boolean;
  // Render only the open-folder dialog (plus its window-event listeners) with
  // no visible trigger. Used by the no-workspace gate, which has no Sidebar —
  // and therefore no other WorkspaceSwitcher instance — mounted to answer its
  // Open folder button.
  dialogOnly?: boolean;
}) {
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
    await activateValidatedPath(trimmed);
  }

  // Validate through the server, then activate. Shared by the manual path
  // entry and the native (Electron) folder picker.
  async function activateValidatedPath(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
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

  // Latest handlers for the native-menu event listeners below (stable
  // subscription, always calls the current render's functions).
  const handlersRef = React.useRef({ pickWorkspaceNative, activateValidatedPath, active });
  handlersRef.current = { pickWorkspaceNative, activateValidatedPath, active };

  // Native menu events from the editor root (N3/N5/N6): the app menu can't
  // reach this component's props, so actions arrive as window events.
  React.useEffect(() => {
    const onPickNative = () => void handlersRef.current.pickWorkspaceNative();
    const onOpenPath = (e: Event) => {
      const dir = (e as CustomEvent<string>).detail;
      if (typeof dir === "string" && dir) void handlersRef.current.activateValidatedPath(dir);
    };
    const onReveal = () => {
      const ws = handlersRef.current.active;
      if (ws) void revealPath(ws);
    };
    window.addEventListener("storeshot:pick-workspace-native", onPickNative);
    window.addEventListener("storeshot:open-workspace-path", onOpenPath);
    window.addEventListener("storeshot:reveal-workspace", onReveal);
    return () => {
      window.removeEventListener("storeshot:pick-workspace-native", onPickNative);
      window.removeEventListener("storeshot:open-workspace-path", onOpenPath);
      window.removeEventListener("storeshot:reveal-workspace", onReveal);
    };
  }, []);

  // Packaged (Electron) builds pick folders through the native dialog so the
  // choice carries a sandbox Powerbox grant. Web builds use the in-app
  // browser below instead.
  async function pickWorkspaceNative() {
    const pick = window.storeshot?.pickWorkspace;
    if (!pick) {
      openBrowser(active ?? undefined);
      return;
    }
    setMenuOpen(false);
    setError(null);
    try {
      const dir = await pick();
      if (dir) await activateValidatedPath(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      {!dialogOnly && (
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
            className="h-9 w-full gap-1.5 px-2 text-xs"
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
          {typeof window !== "undefined" && window.storeshot?.pickWorkspace ? (
            <DropdownMenuItem
              onSelect={() => {
                void pickWorkspaceNative();
              }}
            >
              <span className="flex w-full items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                Open folder…
              </span>
            </DropdownMenuItem>
          ) : (
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
          )}
          {typeof window !== "undefined" && window.storeshot?.revealPath && active ? (
            <DropdownMenuItem
              onSelect={() => {
                void revealPath(active);
              }}
            >
              <span className="flex w-full items-center gap-2">
                <FolderSearch className="h-3.5 w-3.5 text-muted-foreground" />
                Reveal in Finder
              </span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

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
