"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DEVICE_LABEL } from "@/lib/constants";
import type { CopySlidesMode } from "@/lib/copy-slides";
import type { Device, Slide } from "@/lib/types";

export type CopyScreensRequest = {
  from: Device;
  to: Device[];
  mode: CopySlidesMode;
  slideIds?: string[];
};

const OTHER_DEVICES: Record<Device, Device[]> = {
  phone: ["tablet", "desktop"],
  tablet: ["phone", "desktop"],
  desktop: ["phone", "tablet"],
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: Device;
  /** Pre-checked destinations (empty-canvas CTA). */
  presetTo?: Device[];
  slidesByDevice: Record<Device, Slide[]>;
  activeSlideId: string | null;
  disabled?: boolean;
  onCopy: (req: CopyScreensRequest) => void;
};

export function CopyScreensDialog({
  open,
  onOpenChange,
  from,
  presetTo,
  slidesByDevice,
  activeSlideId,
  disabled,
  onCopy,
}: Props) {
  const sourceSlides = slidesByDevice[from] || [];
  const destOptions = OTHER_DEVICES[from];
  const canThis = !!activeSlideId && sourceSlides.some((s) => s.id === activeSlideId);

  const [scope, setScope] = React.useState<"all" | "this">("all");
  const [selected, setSelected] = React.useState<Set<Device>>(new Set());
  const [mode, setMode] = React.useState<CopySlidesMode>("append");

  React.useEffect(() => {
    if (!open) return;
    setScope("all");
    setSelected(new Set(presetTo ?? []));
    setMode("append");
  }, [open, from, presetTo]);

  const selectedList = destOptions.filter((d) => selected.has(d));
  const destHasScreens = selectedList.some((d) => (slidesByDevice[d] || []).length > 0);
  const count = scope === "this" && canThis ? 1 : sourceSlides.length;
  const canSubmit =
    !disabled &&
    selectedList.length > 0 &&
    count > 0 &&
    (scope === "all" || canThis);

  function toggleDest(device: Device, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(device);
      else next.delete(device);
      return next;
    });
  }

  function submit() {
    if (!canSubmit) return;
    onCopy({
      from,
      to: selectedList,
      mode: destHasScreens ? mode : "append",
      slideIds: scope === "this" && activeSlideId ? [activeSlideId] : undefined,
    });
  }

  const screenWord = count === 1 ? "screen" : "screens";
  const submitLabel =
    destHasScreens && mode === "replace"
      ? `Replace ${count} ${screenWord}`
      : `Copy ${count} ${screenWord}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Copy screens to…</DialogTitle>
          <DialogDescription>
            Copy {DEVICE_LABEL[from]} screens onto another device. Layouts adapt
            to the new canvas — you may need to nudge elements after.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="figma-section-label">Copy</legend>
          <RadioGroup
            value={scope}
            onValueChange={(v) => setScope(v as "all" | "this")}
            className="gap-1.5"
          >
            <label
              htmlFor="copy-scope-all"
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px]"
            >
              <RadioGroupItem value="all" id="copy-scope-all" />
              <span>
                All {sourceSlides.length} {sourceSlides.length === 1 ? "screen" : "screens"}
              </span>
            </label>
            <label
              htmlFor="copy-scope-this"
              className={`flex items-center gap-2 rounded-md px-1 py-1 text-[12px] ${
                canThis ? "cursor-pointer" : "cursor-not-allowed opacity-50"
              }`}
            >
              <RadioGroupItem value="this" id="copy-scope-this" disabled={!canThis} />
              <span>This screen</span>
            </label>
          </RadioGroup>
        </fieldset>

        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="figma-section-label">Destination</legend>
          <div className="space-y-1">
            {destOptions.map((device) => {
              const n = (slidesByDevice[device] || []).length;
              const id = `copy-dest-${device}`;
              return (
                <label
                  key={device}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px]"
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(device)}
                    onCheckedChange={(v) => toggleDest(device, v === true)}
                  />
                  <span className="flex-1">{DEVICE_LABEL[device]}</span>
                  <span className="text-[11px] text-figma-secondary">
                    {n} {n === 1 ? "screen" : "screens"}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {destHasScreens ? (
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="figma-section-label">
              Destination already has screens
            </legend>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as CopySlidesMode)}
              className="gap-1.5"
            >
              <label
                htmlFor="copy-mode-append"
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px]"
              >
                <RadioGroupItem value="append" id="copy-mode-append" />
                <span>Append after existing</span>
              </label>
              <label
                htmlFor="copy-mode-replace"
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px]"
              >
                <RadioGroupItem value="replace" id="copy-mode-replace" />
                <span>Replace existing</span>
              </label>
            </RadioGroup>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={destHasScreens && mode === "replace" ? "destructive" : "default"}
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
