// Nice-number tick math for the Figma-style canvas rulers.
// Pure module (no React) so it stays unit-testable under vitest's node env.

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

/** Smallest label step (canvas px) that keeps labels ~64 screen px apart. */
export function chooseStep(scale: number): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const target = 64 / safe;
  for (const step of STEPS) {
    if (step >= target) return step;
  }
  const last = STEPS[STEPS.length - 1];
  return last * Math.ceil(target / last);
}

/** Every step-aligned tick in [min, max] (inclusive). */
export function ticksForRange(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(step > 0) || max < min) {
    return [];
  }
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
    // Round away float dust (e.g. 0.2 minor steps); normalize -0 to 0.
    const rounded = Math.round(v * 1e6) / 1e6;
    ticks.push(rounded === 0 ? 0 : rounded);
    if (ticks.length > 10000) break;
  }
  return ticks;
}
