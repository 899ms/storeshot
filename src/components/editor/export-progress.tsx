"use client";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
type Props = {
  /** Progress string in "done/total" form (e.g. "3/24"). */
  progress: string;
};

function parseProgress(progress: string): { done: number; total: number } | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(progress);
  if (!match) return null;
  const done = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return null;
  return { done: Math.min(done, total), total };
}

export function ExportProgressIndicator({ progress }: Props) {
  const parsed = parseProgress(progress);
  const pct =
    parsed !== null ? Math.round((parsed.done / parsed.total) * 100) : null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-64"
      role="status"
      aria-live="polite"
      aria-label={
        parsed !== null
          ? `Exporting ${parsed.done} of ${parsed.total}`
          : "Exporting screenshots"
      }
    >
      <Card className="space-y-2 p-3 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Download className="h-3.5 w-3.5 text-primary" />
          {parsed !== null ? (
            <span>
              Exporting {parsed.done} of {parsed.total}
            </span>
          ) : (
            <span>Exporting…</span>
          )}
          {pct !== null && (
            <span className="ml-auto font-mono text-muted-foreground">{pct}%</span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          {pct !== null ? (
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          )}
        </div>
      </Card>
    </div>
  );
}
