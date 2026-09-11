"use client";
import * as React from "react";
import { Download, Languages, Loader2, MoreHorizontal, Redo, RotateCcw, Save, Settings, Smartphone, Square, Tablet, Undo, UnfoldHorizontal } from "lucide-react";
import { isMacShell } from "@/lib/native";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  saving: boolean;
  onSave: () => void;
  translatableCount: number;
  translatingLocale: boolean;
  canTranslateLocale: boolean;
  onTranslateLocale: () => void;
  busy: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
};

// Set to true to restore the App name (rename) input in the top bar.
// State, persistence, and export filenames keep working either way.
const SHOW_APP_RENAME = false;

export function Toolbar(props: Props) {
  const [resetOpen, setResetOpen] = React.useState(false);
  const showLocale = props.locales.length > 1;
  const deviceLabel = DEVICE_LABEL[props.device] ?? "iPhone";

  // Inside the macOS shell the window uses hiddenInset traffic lights, so the
  // bar clears them on the left and doubles as the window drag handle.
  const shellBar = isMacShell();
  return (
    <div
      className={`flex h-12 shrink-0 items-center gap-2 overflow-hidden border-b bg-background/80 px-3 backdrop-blur${shellBar ? " electron-shell-bar pl-[76px]" : ""}`}
    >
      {SHOW_APP_RENAME ? (
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Input
            value={props.appName}
            onChange={(e) => props.setAppName(e.target.value)}
            className="h-9 w-32 border-transparent bg-transparent text-sm font-semibold hover:border-input hover:bg-background focus-visible:border-input focus-visible:bg-background lg:w-40"
            placeholder="App name"
            aria-label="App name"
            title="App name (click to edit)"
            disabled={props.busy}
          />
        </div>
      ) : null}

      {/* Center — canvas context */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted/60 p-1">
          {props.setDevice ? (
            <div role="radiogroup" aria-label="Device" className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant={props.device === "iphone" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 gap-1 px-2 text-xs${props.device === "iphone" ? " bg-background shadow-sm" : ""}`}
                onClick={() => props.setDevice?.("iphone")}
                aria-pressed={props.device === "iphone"}
                title='iPhone 6.9" deck'
                disabled={props.busy}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">iPhone</span>
              </Button>
              <Button
                type="button"
                variant={props.device === "ipad" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 gap-1 px-2 text-xs${props.device === "ipad" ? " bg-background shadow-sm" : ""}`}
                onClick={() => props.setDevice?.("ipad")}
                aria-pressed={props.device === "ipad"}
                title='iPad 13" deck'
                disabled={props.busy}
              >
                <Tablet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">iPad</span>
              </Button>
            </div>
          ) : null}
          {props.setDevice ? <Separator orientation="vertical" className="h-5 shrink-0" /> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`h-7 shrink-0 gap-1 px-2 text-xs${props.connectedCanvas ? " bg-background shadow-sm" : ""}`}
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
            <span className="hidden md:inline">{props.connectedCanvas ? "Connected" : "Isolated"}</span>
          </Button>
          {showLocale ? <Separator orientation="vertical" className="h-5 shrink-0" /> : null}

          {showLocale ? (
            <Select value={props.locale} onValueChange={props.setLocale} disabled={props.busy}>
              <SelectTrigger className="h-7 w-28 border-0 bg-transparent text-xs shadow-none focus:ring-0 lg:w-36" aria-label="Language">
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
          ) : null}
        </div>
      </div>
      <span className="sr-only" role="status">
        {props.translatingLocale ? `Translating screens to ${props.locale}…` : ""}
      </span>

      {/* Right — actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {props.onUndo || props.onRedo ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 sm:inline-flex"
              onClick={props.onUndo}
              title="Undo (Cmd/Ctrl+Z)"
              aria-label="Undo"
              disabled={props.busy || !props.onUndo}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 sm:inline-flex"
              onClick={props.onRedo}
              title="Redo (Cmd/Ctrl+Shift+Z)"
              aria-label="Redo"
              disabled={props.busy || !props.onRedo}
            >
              <Redo className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
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
        <Separator orientation="vertical" className="h-5" />
        <ThemeToggle disabled={props.busy} />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={props.onOpenSettings}
          title="Settings (providers, model, languages)"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="More actions (translate, reset)"
              aria-label="More actions"
              disabled={props.busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem onSelect={() => props.onOpenTranslate()} disabled={props.busy}>
              <span className="flex w-full items-center gap-2">
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                Translate all locales…
              </span>
            </DropdownMenuItem>
            {props.locale !== "en" && showLocale ? (
              <DropdownMenuItem
                onSelect={() => props.onTranslateLocale()}
                disabled={
                  props.busy ||
                  props.translatingLocale ||
                  !props.canTranslateLocale ||
                  props.translatableCount === 0
                }
              >
                <span className="flex w-full items-center gap-2">
                  {props.translatingLocale ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {props.translatingLocale
                    ? "Translating…"
                    : `Translate locale (${props.locale})`}
                </span>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setResetOpen(true)} disabled={props.busy}>
              <span className="flex w-full items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                Reset screens to defaults…
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {props.exporting ? (
          <Button
            onClick={props.onStopExport}
            variant="destructive"
            size="sm"
            className="h-9 gap-1.5 px-3 text-xs font-semibold"
            title="Stop export process"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={props.onExport}
            size="sm"
            className="h-9 gap-1.5 px-4"
            title={`Export ${deviceLabel} App Store screenshot bundle as zip (Cmd/Ctrl+E)`}
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
