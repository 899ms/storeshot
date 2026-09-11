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
import { ImagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Device, ScreenBackground, Slide, Theme } from "@/lib/types";
import { newSlide } from "@/lib/defaults";
import { SlideThumb } from "./slide-thumb";

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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">Screens</h2>
        <p className="text-xs text-muted-foreground">
          {slides.length} screen{slides.length === 1 ? "" : "s"} · drag to reorder
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
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

      <div className="border-t bg-card p-3 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          variant="default"
          onClick={() => onAdd(newSlide("device-bottom"))}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" /> Add screen
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onAdd(newSlide("static"))}
          disabled={disabled}
          title="Add a static full-bleed image screen (overlay texts allowed)"
          aria-label="Add static screen"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
