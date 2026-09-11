"use client";
import * as React from "react";
import { chooseStep, ticksForRange } from "@/lib/ruler-ticks";

/** Ruler bar thickness (px). Kept in one place so PreviewStage can reason about it. */
export const RULER_SIZE = 24;

const RULERS_KEY = "screenshots.rulers";

export function loadRulers(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(RULERS_KEY);
    if (v === "0" || v === "1") return v === "1";
  } catch {
    // storage unavailable — fall through to visible
  }
  return true;
}

export function saveRulers(on: boolean) {
  try {
    window.localStorage.setItem(RULERS_KEY, on ? "1" : "0");
  } catch {
    // storage unavailable (private mode etc.) — toggle still applies
  }
}

/** Live canvas geometry. Held in a ref in PreviewStage so scroll updates
 *  never re-render React — rulers redraw imperatively via requestAnimationFrame. */
export type RulerSnapshot = {
  /** Full-resolution scale (fitScale * zoom). */
  scale: number;
  scrollX: number;
  scrollY: number;
  /** Deck origin inside the scroller viewport (screen px, accounts for padding). */
  padL: number;
  padT: number;
  viewW: number;
  viewH: number;
  /** Hover position in canvas px (Figma cursor readout), null when outside. */
  cursorX: number | null;
  cursorY: number | null;
  /** Deck extents in canvas px (area beyond is shaded). */
  totalW: number;
  cH: number;
};

export type RulerHandle = { redraw: () => void };

type Props = { getSnapshot: () => RulerSnapshot };

function rulerColors() {
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  // Mirrors the figma-panel / divider / text-secondary tokens in globals.css.
  return dark
    ? {
        bg: "#2b2b2b",
        line: "#454545",
        tick: "#a6a6a6",
        shade: "rgba(0, 0, 0, 0.28)",
        accent: "#0d99ff",
      }
    : {
        bg: "#ffffff",
        line: "#e5e5e5",
        tick: "#757575",
        shade: "rgba(0, 0, 0, 0.05)",
        accent: "#0d99ff",
      };
}

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return null;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const LABEL_FONT = "9px Inter, system-ui, sans-serif";

function useRedraw(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getSnapshot: () => RulerSnapshot,
  draw: (ctx: CanvasRenderingContext2D, s: RulerSnapshot, w: number, h: number) => void,
) {
  return React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    draw(ctx, getSnapshot(), canvas.clientWidth, canvas.clientHeight);
  }, [canvasRef, getSnapshot, draw]);
}

function drawTop(ctx: CanvasRenderingContext2D, s: RulerSnapshot, w: number, h: number) {
  const c = rulerColors();
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.max(s.scale, 1e-6);
  const toScreen = (v: number) => s.padL + v * scale - s.scrollX;
  // Shade the void outside the deck, like Figma shades off-canvas space.
  const startX = toScreen(0);
  const endX = toScreen(s.totalW);
  ctx.fillStyle = c.shade;
  if (startX > 0) ctx.fillRect(0, 0, Math.min(startX, w), h);
  if (endX < w) ctx.fillRect(Math.max(0, endX), 0, w - Math.max(0, endX), h);

  const step = chooseStep(scale);
  const min = (s.scrollX - s.padL) / scale;
  const max = (s.scrollX - s.padL + w) / scale;
  ctx.strokeStyle = c.tick;
  ctx.fillStyle = c.tick;
  ctx.lineWidth = 1;
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.beginPath();
  for (const v of ticksForRange(min, max, step / 5)) {
    const x = Math.round(toScreen(v)) + 0.5;
    if (x < 0 || x > w) continue;
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - 5);
  }
  ctx.stroke();

  for (const v of ticksForRange(min, max, step)) {
    const x = Math.round(toScreen(v)) + 0.5;
    if (x < -40 || x > w) continue;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - 10);
    ctx.stroke();
    if (x > 2) ctx.fillText(String(Math.round(v)), x + 3, 2);
  }

  if (s.cursorX != null) {
    const x = Math.round(toScreen(s.cursorX)) + 0.5;
    if (x >= 0 && x <= w) {
      ctx.strokeStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = c.line;
  ctx.beginPath();
  ctx.moveTo(0, h - 0.5);
  ctx.lineTo(w, h - 0.5);
  ctx.stroke();
}

function drawLeft(ctx: CanvasRenderingContext2D, s: RulerSnapshot, w: number, h: number) {
  const c = rulerColors();
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  const scale = Math.max(s.scale, 1e-6);
  const toScreen = (v: number) => s.padT + v * scale - s.scrollY;
  const startY = toScreen(0);
  const endY = toScreen(s.cH);
  ctx.fillStyle = c.shade;
  if (startY > 0) ctx.fillRect(0, 0, w, Math.min(startY, h));
  if (endY < h) ctx.fillRect(0, Math.max(0, endY), w, h - Math.max(0, endY));

  const step = chooseStep(scale);
  const min = (s.scrollY - s.padT) / scale;
  const max = (s.scrollY - s.padT + h) / scale;
  ctx.strokeStyle = c.tick;
  ctx.fillStyle = c.tick;
  ctx.lineWidth = 1;
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.beginPath();
  for (const v of ticksForRange(min, max, step / 5)) {
    const y = Math.round(toScreen(v)) + 0.5;
    if (y < 0 || y > h) continue;
    ctx.moveTo(w, y);
    ctx.lineTo(w - 5, y);
  }
  ctx.stroke();

  for (const v of ticksForRange(min, max, step)) {
    const y = Math.round(toScreen(v)) + 0.5;
    if (y < -12 || y > h) continue;
    ctx.beginPath();
    ctx.moveTo(w, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
    if (y > 1) ctx.fillText(String(Math.round(v)), 2, y + 2);
  }

  if (s.cursorY != null) {
    const y = Math.round(toScreen(s.cursorY)) + 0.5;
    if (y >= 0 && y <= h) {
      ctx.strokeStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = c.line;
  ctx.beginPath();
  ctx.moveTo(w - 0.5, 0);
  ctx.lineTo(w - 0.5, h);
  ctx.stroke();
}

const drawTopRef = drawTop;
const drawLeftRef = drawLeft;

export const TopRuler = React.forwardRef<RulerHandle, Props>(function TopRuler(
  { getSnapshot },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const redraw = useRedraw(canvasRef, getSnapshot, drawTopRef);
  React.useImperativeHandle(ref, () => ({ redraw }), [redraw]);
  return <canvas ref={canvasRef} className="block h-6 w-full" aria-hidden="true" />;
});

export const LeftRuler = React.forwardRef<RulerHandle, Props>(function LeftRuler(
  { getSnapshot },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const redraw = useRedraw(canvasRef, getSnapshot, drawLeftRef);
  React.useImperativeHandle(ref, () => ({ redraw }), [redraw]);
  return <canvas ref={canvasRef} className="block h-full w-6" aria-hidden="true" />;
});
