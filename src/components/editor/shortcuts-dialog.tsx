"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⌘/Ctrl + S", action: "Save Now" },
  { keys: "⌘/Ctrl + E", action: "Open Export" },
  { keys: "⌘/Ctrl + Z", action: "Undo" },
  { keys: "⌘/Ctrl + Shift + Z", action: "Redo" },
  { keys: "⌘/Ctrl + D", action: "Duplicate Screen" },
  { keys: "⌘/Ctrl + ⌫", action: "Delete Screen" },
  { keys: "T", action: "Add Text Element" },
  { keys: "Delete", action: "Delete Selected Text" },
  { keys: "↑ / ↓  or  K / J", action: "Previous / Next Screen" },
  { keys: "← → ↑ ↓", action: "Nudge Selected Element (Shift = Big Step)" },
  { keys: "Shift + R", action: "Toggle Rulers" },
  { keys: "Esc", action: "Deselect Element" },
  { keys: "?", action: "Open This Help" },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Work faster without leaving the canvas.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys + shortcut.action}
              className="flex items-center justify-between gap-4 rounded px-2 py-1.5 text-[12px] hover:bg-figma-hover"
            >
              <span className="text-figma-text">{shortcut.action}</span>
              <kbd className="shrink-0 rounded border border-figma-divider bg-figma-hover px-1.5 py-0.5 font-mono text-[11px] text-figma-secondary">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
