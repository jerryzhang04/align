import type { ProviderMode } from "@align/contracts";
import { isSponsoredOmniModel, isYibuBaseUrl } from "./omniModels.js";

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
  const hasKey = Boolean(apiKey);
  const isOmni = hasKey && isYibuBaseUrl(baseUrl) && isSponsoredOmniModel(model);
  const mode: ProviderMode = isOmni ? "omni" : "unconfigured";
  const nativeAudioExpected = isOmni && (environment.OMNI_AUDIO_OUTPUT ?? "true").toLowerCase() !== "false";
  return {
    configured: hasKey,
    mode,
    provider: isOmni ? "yibu" : null,
    model,
    baseUrl,
    apiKey,
    nativeAudioExpected,
  };
}
