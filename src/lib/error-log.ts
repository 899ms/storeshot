"use client";
import * as React from "react";

// Session-scoped error log. Any module can report; UI subscribes via
// useErrorLog(). Entries never leave the browser — copy puts plain text on
// the clipboard so the user can paste it into a bug report.

export type ErrorEntry = {
  id: string;
  time: number;
  source: string;
  message: string;
  detail?: string;
};

const MAX_ENTRIES = 100;

let entries: ErrorEntry[] = [];
let unseen = 0;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function reportError(source: string, message: string, detail?: string) {
  const entry: ErrorEntry = {
    id: `e_${Date.now().toString(36)}_${seq++}`,
    time: Date.now(),
    source,
    message,
    detail,
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  unseen += 1;
  emit();
}

export function formatErrorLog(list: ErrorEntry[]): string {
  return list
    .map(
      (e) =>
        `[${new Date(e.time).toISOString()}] ${e.source}: ${e.message}` +
        (e.detail ? `\n  ${e.detail}` : ""),
    )
    .join("\n");
}

export async function copyErrorLog(list: ErrorEntry[]): Promise<boolean> {
  const text = formatErrorLog(list) || "No errors logged.";
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function useErrorLog() {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const fn = () => tick((x) => x + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const markSeen = React.useCallback(() => {
    if (unseen === 0) return;
    unseen = 0;
    emit();
  }, []);

  const clear = React.useCallback(() => {
    entries = [];
    unseen = 0;
    emit();
  }, []);

  return { entries, unread: unseen, markSeen, clear };
}
