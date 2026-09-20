import type { ProviderMode } from "@align/contracts";

export type ProviderEnvironment = Record<string, string | undefined>;

export type ProviderConfig = {
  configured: boolean;
  mode: ProviderMode;
  provider: "yibu" | null;
  model: string;
  baseUrl: string;
  apiKey: string;
  nativeAudioExpected: boolean;
};

export function resolveProviderConfig(environment: ProviderEnvironment = process.env): ProviderConfig {
  const apiKey = (environment.OMNI_API_KEY ?? "").trim();
  const baseUrl = (environment.OMNI_BASE_URL ?? "https://yibuapi.com/v1").trim().replace(/\/$/, "");
  const model = (environment.OMNI_MODEL ?? "qwen3.5-omni-plus").trim();
  const configured = Boolean(apiKey);
  let isYibu = false;
  try {
    isYibu = /(^|\.)yibuapi\.com$/i.test(new URL(baseUrl).hostname);
  } catch {
    isYibu = false;
  }
  const isOmni = configured && isYibu && model === "qwen3.5-omni-plus";
  const mode: ProviderMode = isOmni ? "omni" : "unconfigured";
  const nativeAudioExpected = mode === "omni" && (environment.OMNI_AUDIO_OUTPUT ?? "true").toLowerCase() !== "false";
  return { configured: isOmni, mode, provider: isOmni ? "yibu" : null, model, baseUrl, apiKey, nativeAudioExpected };
}
