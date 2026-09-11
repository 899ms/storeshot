import type { ElementId, Slide } from "./types";
import { toTextElementId } from "./elements";

export type ScreenLayer = {
  id: ElementId;
  label: string;
  kind: "caption" | "device" | "deviceSecondary" | "text";
};

/** Mirrors inspector's present[] logic so sidebar layers never drift. */
export function getScreenLayers(slide: Slide): ScreenLayer[] {
  const layers: ScreenLayer[] = [];
  const isStatic = slide.layout === "static";
  if (!isStatic) {
    layers.push({ id: "caption", label: "Headline", kind: "caption" });
  }
  if (!isStatic && slide.layout !== "no-device") {
    layers.push({ id: "device", label: "Device", kind: "device" });
  }
  if (!isStatic && slide.layout === "two-devices") {
    layers.push({ id: "deviceSecondary", label: "Back device", kind: "deviceSecondary" });
  }
  for (const element of slide.textElements || []) {
    layers.push({
      id: toTextElementId(element.id),
      label: "Text",
      kind: "text",
    });
  }
  return layers;
}
