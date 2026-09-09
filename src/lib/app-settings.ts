"use client";
import * as React from "react";

// App-level settings (per machine, NOT per workspace): LLM providers, active
// provider, and model. Persisted in localStorage only — API keys never touch
// workspace files, git, or our server logs. Keys are sent solely to the
// configured provider base URL from the browser.

export type ProviderConfig = {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
};

export type AppSettings = {
  providers: ProviderConfig[];
  activeProviderId: string;
  model: string;
};

const SETTINGS_KEY = "screenshots.app-settings:v1";

export const OPENROUTER_PRESET: ProviderConfig = {
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "",
};

export const DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [{ ...OPENROUTER_PRESET }],
  activeProviderId: "openrouter",
  model: DEFAULT_MODEL,
};

function nid(): string {
  return "p_" + Math.random().toString(36).slice(2, 9);
}

export function newProvider(): ProviderConfig {
  return { id: nid(), label: "Custom provider", baseUrl: "https://", apiKey: "" };
}

function sanitize(parsed: unknown): AppSettings {
  if (!parsed || typeof parsed !== "object") return structuredClone(DEFAULT_SETTINGS);
  const raw = parsed as Partial<AppSettings>;
  const providers = Array.isArray(raw.providers)
    ? raw.providers
        .filter((p) => p && typeof p === "object")
        .map((p) => {
          const q = p as Partial<ProviderConfig>;
          return {
            id: typeof q.id === "string" && q.id ? q.id : nid(),
            label: typeof q.label === "string" && q.label ? q.label : "Custom provider",
            baseUrl: typeof q.baseUrl === "string" ? q.baseUrl.replace(/\/+$/, "") : "",
            apiKey: typeof q.apiKey === "string" ? q.apiKey : "",
          };
        })
    : [];
  if (providers.length === 0) providers.push({ ...OPENROUTER_PRESET });
  const activeProviderId =
    typeof raw.activeProviderId === "string" &&
    providers.some((p) => p.id === raw.activeProviderId)
      ? raw.activeProviderId
      : providers[0].id;
  const model =
    typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : DEFAULT_MODEL;
  return { providers, activeProviderId, model };
}

function load(): AppSettings {
  if (typeof window === "undefined") return structuredClone(DEFAULT_SETTINGS);
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    return sanitize(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function activeProvider(settings: AppSettings): ProviderConfig {
  return (
    settings.providers.find((p) => p.id === settings.activeProviderId) || settings.providers[0]
  );
}

export function useAppSettings() {
  const [settings, setSettings] = React.useState<AppSettings>(load);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage failures
    }
  }, [settings]);

  const patchProvider = React.useCallback((id: string, patch: Partial<ProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      providers: prev.providers.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              baseUrl:
                patch.baseUrl !== undefined ? patch.baseUrl.replace(/\/+$/, "") : p.baseUrl,
            }
          : p,
      ),
    }));
  }, []);

  const addProvider = React.useCallback(() => {
    const next = newProvider();
    setSettings((prev) => ({ ...prev, providers: [...prev.providers, next] }));
    return next.id;
  }, []);

  const removeProvider = React.useCallback((id: string) => {
    setSettings((prev) => {
      if (prev.providers.length <= 1) return prev;
      const providers = prev.providers.filter((p) => p.id !== id);
      return {
        ...prev,
        providers,
        activeProviderId:
          prev.activeProviderId === id ? providers[0].id : prev.activeProviderId,
      };
    });
  }, []);

  return { settings, setSettings, patchProvider, addProvider, removeProvider };
}

// Lightweight connection check: list models with the stored key. Returns the
// model count on success so the UI can confirm the key works.
export async function testProviderConnection(
  provider: ProviderConfig,
): Promise<{ ok: true; modelCount: number } | { ok: false; error: string }> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  if (!base) return { ok: false, error: "Base URL is empty" };
  if (!provider.apiKey) return { ok: false, error: "API key is empty" };
  try {
    const resp = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
    });
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const json = (await resp.json()) as { error?: { message?: string } | string };
        const msg =
          typeof json?.error === "string" ? json.error : json?.error?.message;
        if (msg) detail = msg;
      } catch {
        // keep status text
      }
      return { ok: false, error: detail };
    }
    const json = (await resp.json()) as { data?: unknown[] };
    return { ok: true, modelCount: Array.isArray(json?.data) ? json.data.length : 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
