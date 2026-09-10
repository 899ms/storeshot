"use client";
import { LOCALE_NAMES, pickText, writeLocalized } from "./locale";
import type { Slide } from "./types";

// In-app translation via any OpenAI-compatible chat-completions endpoint
// (OpenRouter by default). Static screens carry no text and are skipped.
// One request per chunk of slides per target locale; failures throw a
// TranslateError with the provider's message so the UI can report per locale.

const SLIDES_PER_REQUEST = 10;

export class TranslateError extends Error {}

export type SlideTranslation = {
  label?: string;
  headline?: string;
  texts?: Record<string, string>;
};

export type TranslateProgress = {
  doneLocales: number;
  totalLocales: number;
  currentLocale: string | null;
};

export type TranslateCall = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

function targetName(locale: string): string {
  return LOCALE_NAMES[locale] || locale;
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const err = (body as { error?: { message?: unknown } | string }).error;
    if (typeof err === "string" && err) return err;
    if (err && typeof err === "object" && typeof err.message === "string" && err.message) {
      return err.message;
    }
  }
  return `HTTP ${status}`;
}

type SourceSlide = {
  id: string;
  label?: string;
  headline?: string;
  texts?: Record<string, string>;
};

function collectSources(
  slides: Slide[],
  sourceLocale: string,
  targetLocale: string,
  overwrite: boolean,
): SourceSlide[] {
  const out: SourceSlide[] = [];
  for (const slide of slides) {
    // Static screens carry no label/headline — only overlay texts.
    const entry: SourceSlide = { id: slide.id };
    // Only send units that actually need translation: non-empty in the
    // source and (empty in the target, unless overwriting).
    if (slide.layout !== "static") {
      const labelSrc = pickText(slide.label, sourceLocale).trim();
      const labelHas = (slide.label?.[targetLocale] || "").trim().length > 0;
      if (labelSrc && (overwrite || !labelHas)) entry.label = labelSrc;
      const headlineSrc = pickText(slide.headline, sourceLocale).trim();
      const headlineHas = (slide.headline?.[targetLocale] || "").trim().length > 0;
      if (headlineSrc && (overwrite || !headlineHas)) entry.headline = headlineSrc;
    }
    const texts: Record<string, string> = {};
    for (const el of slide.textElements || []) {
      const src = pickText(el.text, sourceLocale).trim();
      const has = (el.text?.[targetLocale] || "").trim().length > 0;
      if (src && (overwrite || !has)) texts[el.id] = src;
    }
    if (Object.keys(texts).length > 0) entry.texts = texts;
    if (entry.label !== undefined || entry.headline !== undefined || entry.texts) {
      out.push(entry);
    }
  }
  return out;
}

function buildMessages(
  sources: SourceSlide[],
  sourceLocale: string,
  targetLocale: string,
): { role: string; content: string }[] {
  return [
    {
      role: "system",
      content: [
        "You are a professional mobile-app store copy translator.",
        `Translate the given UI strings from ${targetName(sourceLocale)} (${sourceLocale}) to ${targetName(targetLocale)} (${targetLocale}).`,
        "Rules:",
        "- Preserve newlines (\\n) and their positions exactly.",
        "- Keep ALL-CAPS styling where the source is all caps.",
        "- Keep placeholders like {locale} untouched.",
        "- Keep translations concise and punchy, App Store style.",
        "- Return ONLY a JSON object keyed by screen id.",
      ].join("\n"),
    },
    {
      role: "user",
      content:
        "Translate this JSON to " +
        targetLocale +
        ". Response format: { \"<screenId>\": { \"label\"?: string, \"headline\"?: string, \"texts\"?: { \"<elementId>\": string } } }. Include only keys present in the input.\n\n" +
        JSON.stringify(
          Object.fromEntries(
            sources.map((s) => [
              s.id,
              {
                ...(s.label !== undefined ? { label: s.label } : {}),
                ...(s.headline !== undefined ? { headline: s.headline } : {}),
                ...(s.texts ? { texts: s.texts } : {}),
              },
            ]),
          ),
        ),
    },
  ];
}

function sanitizeResult(json: unknown): Record<string, SlideTranslation> {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new TranslateError("Model returned malformed JSON (expected an object)");
  }
  const out: Record<string, SlideTranslation> = {};
  for (const [slideId, value] of Object.entries(json as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const entry: SlideTranslation = {};
    if (typeof v.label === "string" && v.label.trim()) entry.label = v.label;
    if (typeof v.headline === "string" && v.headline.trim()) entry.headline = v.headline;
    if (v.texts && typeof v.texts === "object" && !Array.isArray(v.texts)) {
      const texts: Record<string, string> = {};
      for (const [elId, text] of Object.entries(v.texts as Record<string, unknown>)) {
        if (typeof text === "string" && text.trim()) texts[elId] = text;
      }
      if (Object.keys(texts).length > 0) entry.texts = texts;
    }
    if (entry.label !== undefined || entry.headline !== undefined || entry.texts) {
      out[slideId] = entry;
    }
  }
  return out;
}

async function translateChunk(
  call: TranslateCall,
  sources: SourceSlide[],
  sourceLocale: string,
  targetLocale: string,
  signal?: AbortSignal,
): Promise<Record<string, SlideTranslation>> {
  const base = call.baseUrl.replace(/\/+$/, "");
  let resp: Response;
  try {
    resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${call.apiKey}`,
      },
      body: JSON.stringify({
        model: call.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: buildMessages(sources, sourceLocale, targetLocale),
      }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new TranslateError(e instanceof Error ? e.message : String(e));
  }
  let body: unknown = null;
  try {
    body = await resp.json();
  } catch {
    // fall through to status check with empty body
  }
  if (!resp.ok) {
    throw new TranslateError(errorMessage(resp.status, body));
  }
  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new TranslateError("Model returned an empty response");
  }
  try {
    return sanitizeResult(JSON.parse(content));
  } catch (e) {
    if (e instanceof TranslateError) throw e;
    throw new TranslateError("Model returned malformed JSON");
  }
}

export async function translateSlidesForLocale(
  call: TranslateCall,
  slides: Slide[],
  sourceLocale: string,
  targetLocale: string,
  options: { overwrite?: boolean; signal?: AbortSignal } = {},
): Promise<Record<string, SlideTranslation>> {
  if (!call.apiKey) throw new TranslateError("API key is empty");
  if (!call.model.trim()) throw new TranslateError("Model is empty");
  const sources = collectSources(slides, sourceLocale, targetLocale, !!options.overwrite);
  const merged: Record<string, SlideTranslation> = {};
  for (let i = 0; i < sources.length; i += SLIDES_PER_REQUEST) {
    const chunk = sources.slice(i, i + SLIDES_PER_REQUEST);
    const result = await translateChunk(call, chunk, sourceLocale, targetLocale, options.signal);
    for (const [slideId, tr] of Object.entries(result)) {
      const existing = merged[slideId] || {};
      merged[slideId] = {
        label: tr.label ?? existing.label,
        headline: tr.headline ?? existing.headline,
        texts: { ...(existing.texts || {}), ...(tr.texts || {}) },
      };
    }
  }
  return merged;
}

// Count units that would be sent (for progress labels and empty-state).
export function countPendingUnits(
  slides: Slide[],
  sourceLocale: string,
  targetLocale: string,
): number {
  return collectSources(slides, sourceLocale, targetLocale, false).reduce(
    (n, s) =>
      n +
      (s.label !== undefined ? 1 : 0) +
      (s.headline !== undefined ? 1 : 0) +
      Object.keys(s.texts || {}).length,
    0,
  );
}

// Apply translations to the current-device deck. Returns new slides; the
// caller applies them via setState so the run stays a single undo step.
export function applyLocaleTranslations(
  slides: Slide[],
  results: Record<string, SlideTranslation>,
  targetLocale: string,
  overwrite: boolean,
): Slide[] {
  return slides.map((slide) => {
    const tr = results[slide.id];
    if (!tr) return slide;
    const next: Slide = { ...slide };
    if (tr.label !== undefined) {
      const has = (slide.label?.[targetLocale] || "").trim().length > 0;
      if (overwrite || !has) next.label = writeLocalized(slide.label, targetLocale, tr.label);
    }
    if (tr.headline !== undefined) {
      const has = (slide.headline?.[targetLocale] || "").trim().length > 0;
      if (overwrite || !has)
        next.headline = writeLocalized(slide.headline, targetLocale, tr.headline);
    }
    if (tr.texts && slide.textElements) {
      next.textElements = slide.textElements.map((el) => {
        const text = tr.texts?.[el.id];
        if (text === undefined) return el;
        const has = (el.text?.[targetLocale] || "").trim().length > 0;
        if (!overwrite && has) return el;
        return { ...el, text: writeLocalized(el.text, targetLocale, text) };
      });
    }
    return next;
  });
}
