"use client";
import * as React from "react";
import { AlertTriangle, Check, Cloud, Download, RotateCcw, Smartphone, Square, Tablet, UnfoldHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Device, Orientation } from "@/lib/types";
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
  orientation?: Orientation;
  setOrientation?: (v: Orientation) => void;
  onExport: () => void;
  onStopExport?: () => void;
  onResetAll: () => void;
  onResetDevice?: () => void;
  exporting: string | null;
  savedAt: number | null;
  saveError: string | null;
  busy: boolean;
};

export function Toolbar(props: Props) {
  const [resetOpen, setResetOpen] = React.useState(false);
  const showLocale = props.locales.length > 1;
  const deviceLabel = DEVICE_LABEL[props.device] ?? "iPhone";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b bg-card/40 px-4 py-2">
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
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <SaveStatus savedAt={props.savedAt} saveError={props.saveError} />
        <Separator orientation="vertical" className="h-5" />
        <ThemeToggle disabled={props.busy} />
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
            Export bundle
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

function SaveStatus({ savedAt, saveError }: { savedAt: number | null; saveError: string | null }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

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
