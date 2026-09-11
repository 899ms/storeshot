"use client";
import * as React from "react";
import { Bug, Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyErrorLog, useErrorLog } from "@/lib/error-log";

export function ErrorLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { entries, clear, markSeen } = useErrorLog();
  const [copied, setCopied] = React.useState(false);
  // Two-step clear: first click arms, second confirms. Resets on close.
  const [confirmingClear, setConfirmingClear] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      markSeen();
      setCopied(false);
      setConfirmingClear(false);
    }
  }, [open, markSeen]);

  async function handleCopy() {
    const ok = await copyErrorLog(entries);
    if (ok) {
      setCopied(true);
      toast.success("Error log copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[70vh] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 gap-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-1.5 text-base font-bold">
            <Bug className="h-4 w-4 text-muted-foreground" /> Error log
            {entries.length > 0 && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                {entries.length}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Recent app errors, newest first. Copy and paste it into a bug report.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {entries.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No errors logged. If something breaks, it will show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-border/70 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="px-1 py-0 text-[9px]">
                      {e.source}
                    </Badge>
                    <span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground">
                      {new Date(e.time).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 font-medium leading-snug">{e.message}</p>
                  {e.detail && (
                    <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-1.5 font-mono text-[10px] leading-snug text-muted-foreground">
                      {e.detail}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t px-6 py-3 sm:justify-end">
          <Button
            type="button"
            variant={confirmingClear ? "destructive" : "ghost"}
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
            disabled={entries.length === 0}
            onClick={() => {
              if (confirmingClear) {
                clear();
                setConfirmingClear(false);
              } else {
                setConfirmingClear(true);
              }
            }}
            onBlur={() => setConfirmingClear(false)}
            title={confirmingClear ? "Click again to confirm clearing" : "Clear log"}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmingClear ? `Confirm clear (${entries.length})` : "Clear"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 text-xs"
            disabled={entries.length === 0}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
