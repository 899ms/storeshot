"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
};

// Radio semantics with a single tab stop: arrows/Home/End move selection,
// matching native radio-group keyboard behavior.
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  layout = "stacked",
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  layout?: "stacked" | "inline";
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const current = options.findIndex((o) => o.value === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (current + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (current - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = options.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const opt = options[next];
    onChange(opt.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => {
        const selected = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              layout === "stacked"
                ? "flex flex-col items-center gap-0.5 px-1 py-1.5"
                : "flex items-center gap-1 px-2 py-1",
              "rounded-md border text-[11px]",
              selected
                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary/40"
                : "border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            <span className={cn(layout === "stacked" && "text-[10px] font-medium leading-none")}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
