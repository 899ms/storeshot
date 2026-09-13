"use client";

import * as React from "react";
import { Check, Download, FolderOpen, Image as ImageIcon, Languages, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SAMPLE_IMAGES,
  markOnboardingSeen,
} from "@/lib/onboarding";
import {
  setActiveWorkspace,
  touchRecentWorkspace,
  useActiveWorkspace,
} from "@/lib/workspaces";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Apply bundled sample screenshots to the current deck. */
  onApplySamples: () => void;
};

const STEPS = ["Welcome", "Workspace", "Samples"] as const;

export function OnboardingDialog({ open, onOpenChange, onApplySamples }: Props) {
  const workspace = useActiveWorkspace();
  const [step, setStep] = React.useState(0);
  const [choice, setChoice] = React.useState<"samples" | "blank">("samples");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fresh state on every open so replay always starts at step 0.
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setChoice("samples");
      setError(null);
      setPending(false);
    }
  }, [open]);

  function close(seen: boolean) {
    if (seen) markOnboardingSeen();
    onOpenChange(false);
  }

  async function chooseFolder() {
    setPending(true);
    setError(null);
    try {
      const pick = window.storeshot?.pickWorkspace;
      const dir = pick ? await pick() : null;
      if (!dir) {
        // Web builds have no native picker: the folder button in the
        // toolbar opens the in-app browser instead.
        setError("Use the folder button in the toolbar to pick a workspace on web.");
        return;
      }
      const resp = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: dir }),
      });
      const json = (await resp.json()) as { ok: boolean; path?: string; error?: string };
      if (!json.ok || !json.path) {
        setError(json.error || "Could not open workspace");
        return;
      }
      touchRecentWorkspace(json.path);
      setActiveWorkspace(json.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function finish() {
    if (choice === "samples") onApplySamples();
    close(true);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close(true)}>
      <DialogContent
        className="max-h-[90vh] max-w-xl overflow-y-auto p-6"
        aria-describedby="onboarding-desc"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                {step === 0 && "Welcome to StoreShot"}
                {step === 1 && "Where should projects live?"}
                {step === 2 && "Start with samples?"}
              </DialogTitle>
              <DialogDescription id="onboarding-desc">
                Step {step + 1} of {STEPS.length} — {STEPS[step]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* Fixed body height so the dialog doesn't jump between steps. */}
        <div className="min-h-[300px]">
        {step === 0 && (
          <ul className="space-y-3">
            {[
              { icon: Layers, title: "Design", body: "App Store + Google Play screenshots on a drag-and-drop canvas." },
              { icon: Languages, title: "Localize", body: "Every screen into store locales, with AI translation." },
              { icon: Download, title: "Export", body: "A complete, correctly-named PNG bundle in one click." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-none">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug">{title}</span>
                  <span className="block text-sm text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Projects save as plain files inside your workspace&apos;s{" "}
              <span className="font-mono text-xs">screenshots/</span> folder — commit it
              with git and resume anywhere. Until you pick one, work stays in this
              machine&apos;s memory.
            </p>
            <Card className="flex items-center gap-3 p-4 shadow-none">
              <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {workspace ?? "No workspace chosen yet"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {workspace ? "Autosaves here as you type" : "Required for saving — work is memory-only until then"}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => void chooseFolder()}
                disabled={pending}
              >
                {pending ? "Opening…" : workspace ? "Change…" : "Choose folder…"}
              </Button>
            </Card>
            <ul className="space-y-2 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground">
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Every keystroke autosaves in under a second — no save button needed.
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Switch workspaces anytime from the toolbar; pending saves flush first.
              </li>
            </ul>
            {error && (
              <p role="alert" className="text-xs text-destructive">{error}</p>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
            <Card
              role="radio"
              aria-checked={choice === "samples"}
              tabIndex={0}
              onClick={() => setChoice("samples")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setChoice("samples");
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col space-y-3 p-4 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                choice === "samples"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/40",
              )}
            >
              <div className="flex gap-1.5 overflow-hidden rounded-md">
                {SAMPLE_IMAGES.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="h-36 min-w-0 flex-1 object-cover" />
                ))}
              </div>
              <p className="text-[15px] font-semibold">Sample deck</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Five ready-made screens — export your first bundle in a minute, then
                swap in your own screenshots.
              </p>
            </Card>
            <Card
              role="radio"
              aria-checked={choice === "blank"}
              tabIndex={0}
              onClick={() => setChoice("blank")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setChoice("blank");
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col space-y-3 p-4 shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
                choice === "blank"
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "hover:bg-muted/40",
              )}
            >
              <div className="flex h-36 items-center justify-center rounded-md bg-muted/60">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-semibold">Blank deck</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Empty screenshot slots — bring your own images from the start.
              </p>
            </Card>
          </div>
        )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full sm:w-auto"
            onClick={() => close(true)}
          >
            Skip
          </Button>
          <div className="flex w-full flex-1 flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                className="h-11 w-full sm:w-auto"
                onClick={() => setStep(step + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button type="button" className="h-11 w-full sm:w-auto" onClick={finish}>
                Start creating
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
