"use client";
import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Device, ScreenBackground, Slide, Theme } from "@/lib/types";
import { newSlide } from "@/lib/defaults";
import { useActiveWorkspace } from "@/lib/workspaces";
import { SlideThumb } from "./slide-thumb";
import { WorkspaceSwitcher } from "./workspace-switcher";

type Props = {
  slides: Slide[];
  activeId: string | null;
  device: Device;
  theme: Theme;
  locale: string;
  connectedCanvas: boolean;
  headlineFont?: string;
  labelFont?: string;
  background?: ScreenBackground;
  disabled?: boolean;
  onReorder: (next: Slide[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (slide: Slide) => void;
};

export function Sidebar({
  slides,
  activeId,
  device,
  theme,
  locale,
  connectedCanvas,
  headlineFont,
  labelFont,
  background,
  disabled,
  onReorder,
  onSelect,
  onDelete,
  onDuplicate,
  onAdd,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder(arrayMove(slides, oldIdx, newIdx));
  };

  const activeWorkspace = useActiveWorkspace();

  return (
    <div className="figma-thin-scroll flex h-full flex-col bg-figma-panel text-figma-text">
      <div className="border-b border-figma-divider px-3 py-2.5">
        <h2 className="figma-section-label">Workspace</h2>
        <div className="mt-1.5">
          <WorkspaceSwitcher disabled={disabled} />
        </div>
        {activeWorkspace ? (
          <p className="mt-1 truncate font-mono text-[10px] text-figma-secondary" title={activeWorkspace}>
            {activeWorkspace}
          </p>
        ) : null}
      </div>
      <div className="border-b border-figma-divider px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="figma-section-label">Layers</h2>
          <span className="rounded bg-figma-hover px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-figma-secondary">
            {slides.length}
          </span>
          <span className="ml-auto text-[11px] text-figma-secondary">Screens</span>
        </div>
        <p className="mt-0.5 text-[11px] text-figma-secondary">
          drag to reorder
        </p>
      </div>

      <div className="figma-thin-scroll flex-1 overflow-y-auto p-1.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {slides.map((slide, i) => (
                <SlideThumb
                  key={slide.id}
                  slide={slide}
                  slides={slides}
                  index={i}
                  active={slide.id === activeId}
                  device={device}
                  theme={theme}
                  locale={locale}
                  connectedCanvas={connectedCanvas}
                  headlineFont={headlineFont}
                  labelFont={labelFont}
                  background={background}
                  onSelect={() => onSelect(slide.id)}
                  onDelete={() => onDelete(slide.id)}
                  onDuplicate={() => onDuplicate(slide.id)}
                />
              ))}
              {slides.length === 0 && (
                <Card className="border-dashed p-6 text-center shadow-none">
                  <p className="text-xs font-medium text-foreground">No screens yet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Click <span className="font-semibold">Add screen</span> to get started.
                  </p>
                </Card>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t border-figma-divider bg-figma-panel p-2">
        <Button
          type="button"
          className="h-8 w-full rounded-md bg-figma-accent text-[12px] font-semibold text-white shadow-sm hover:bg-figma-accent/90"
          onClick={() => onAdd(newSlide("device-bottom"))}
          disabled={disabled}
          title="For a full-bleed image screen, add a screen then switch its Layout to Static image"
        >
          <Plus className="h-4 w-4" /> Add screen
        </Button>
      </div>
    </div>
  );
}
