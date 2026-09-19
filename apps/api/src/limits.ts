export const LIMITS = {
  imageBytes: 1_000_000,
  audioBytes: 5_000_000,
  audioSeconds: 15,
  metaBytes: 32_000,
  timeoutMs: 45_000,
};

export const ALLOWED_IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_AUDIO = new Set(["audio/wav", "audio/x-wav", "audio/wave", "audio/mpeg", "audio/mp4", "audio/webm"]);
