export const SPONSORED_OMNI_MODELS = [
  "qwen3.5-omni-flash",
  "qwen3.5-omni-plus",
  "qwen3.5-omni-plus-realtime",
  "qwen3.8-omni-flash",
  "gemini-3.1-flash-live-preview",
] as const;

export function isSponsoredOmniModel(model: string) {
  return (SPONSORED_OMNI_MODELS as readonly string[]).includes(model.trim());
}

export function isYibuBaseUrl(value: string) {
  try {
    return /(^|\.)yibuapi\.com$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}
