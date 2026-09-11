// StoreShot MCP provider translation — same engine as the in-app Translate
// dialog (src/lib/translate.ts), applied to the current-device deck.
//
// KEY SAFETY: the provider key arrives per call, lives only in this call's
// closure, and is never written to disk, logs, or tool results. Errors are
// re-wrapped so a provider message can never echo request credentials.

import {
  applyLocaleTranslations,
  countSentUnits,
  TranslateError,
  translateSlidesForLocale,
} from "../lib/translate";
import type { Device, ProjectState, Slide } from "../lib/types";
import { McpError } from "./project-io";

export type ProviderTranslateParams = {
  targetLocale: unknown;
  sourceLocale?: unknown;
  device?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  apiKey: unknown;
  overwrite?: unknown;
  timeoutMs?: unknown;
};

export type ProviderTranslateReport = {
  targetLocale: string;
  sourceLocale: string;
  sent: number;
  received: number;
  dropped: string[];
  applied: boolean;
};

function deckOf(state: ProjectState, device: unknown): { device: Device; slides: Slide[] } {
  const raw = device == null ? state.device : device;
  const dev: Device = raw === "tablet" || raw === "ipad" ? "tablet" : raw === "desktop" ? "desktop" : "phone";
  return { device: dev, slides: state.slidesByDevice[dev] ?? [] };
}

function countReceived(results: Record<string, { label?: string; headline?: string; texts?: Record<string, string> }>): number {
  let n = 0;
  for (const r of Object.values(results)) {
    if (r.label !== undefined) n += 1;
    if (r.headline !== undefined) n += 1;
    n += Object.keys(r.texts ?? {}).length;
  }
  return n;
}

function findDropped(
  slides: Slide[],
  results: Record<string, { label?: string; headline?: string; texts?: Record<string, string> }>,
  source: string,
): string[] {
  const out: string[] = [];
  for (const slide of slides) {
    const r = results[slide.id];
    if (slide.layout !== "static") {
      if ((slide.label?.[source] || "").trim() && r?.label === undefined) out.push(`${slide.id}:label`);
      if ((slide.headline?.[source] || "").trim() && r?.headline === undefined) out.push(`${slide.id}:headline`);
    }
    for (const el of slide.textElements ?? []) {
      if ((el.text?.[source] || "").trim() && r?.texts?.[el.id] === undefined) {
        out.push(`${slide.id}:text:${el.id}`);
      }
    }
  }
  return out;
}

export async function runProviderTranslation(
  state: ProjectState,
  params: ProviderTranslateParams,
): Promise<{ state: ProjectState; report: ProviderTranslateReport }> {
  if (typeof params.targetLocale !== "string" || !params.targetLocale.trim()) {
    throw new McpError("targetLocale is required");
  }
  const target = params.targetLocale.trim();
  const source = typeof params.sourceLocale === "string" && params.sourceLocale.trim()
    ? params.sourceLocale.trim()
    : "en";
  if (typeof params.apiKey !== "string" || !params.apiKey) {
    throw new McpError("apiKey is required (per-call only; never stored)");
  }
  const baseUrl = typeof params.baseUrl === "string" && params.baseUrl.trim()
    ? params.baseUrl.trim()
    : "https://openrouter.ai/api/v1";
  if (typeof params.model !== "string" || !params.model.trim()) {
    throw new McpError("model is required");
  }
  const overwrite = params.overwrite !== false;
  const timeoutMs = typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs)
    ? Math.min(600000, Math.max(10000, params.timeoutMs))
    : 180000;

  const { device, slides } = deckOf(state, params.device);
  const sent = countSentUnits(slides, source, target);
  if (sent === 0) {
    return { state, report: { targetLocale: target, sourceLocale: source, sent: 0, received: 0, dropped: [], applied: false } };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let results: Record<string, { label?: string; headline?: string; texts?: Record<string, string> }>;
  try {
    // apiKey is used here and never leaves this closure.
    results = await translateSlidesForLocale(
      { baseUrl, apiKey: params.apiKey, model: params.model.trim() },
      slides,
      source,
      target,
      { overwrite, signal: ctrl.signal },
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new McpError(`Translation timed out after ${timeoutMs}ms (nothing was written)`);
    }
    if (e instanceof TranslateError) throw new McpError(`Provider failed (nothing was written): ${e.message}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const received = countReceived(results);
  const dropped = overwrite ? [] : findDropped(slides, results, source);
  const nextSlides = applyLocaleTranslations(slides, results, target, overwrite);
  return {
    state: { ...state, slidesByDevice: { ...state.slidesByDevice, [device]: nextSlides } },
    report: { targetLocale: target, sourceLocale: source, sent, received, dropped, applied: true },
  };
}
