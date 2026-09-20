import type { CoachTurnMeta, CoachTurnResponse, HealthResponse } from "@align/contracts";

const token = import.meta.env.VITE_ALIGN_API_TOKEN as string | undefined;

function headers(): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/v1/health");
  if (!response.ok) {
    return {
      ok: false,
      omniConfigured: false,
      guidanceConfigured: false,
      providerMode: "unconfigured",
      provider: null,
      nativeAudioExpected: false,
      model: null,
    };
  }
  return (await response.json()) as HealthResponse;
}

export async function sendCoachTurn(input: {
  meta: CoachTurnMeta;
  image: Blob;
  audio: Blob;
  signal?: AbortSignal;
}): Promise<CoachTurnResponse> {
  const body = new FormData();
  body.set("meta", JSON.stringify(input.meta));
  body.set("image", input.image, "frame.jpg");
  body.set("audio", input.audio, "speech.wav");
  const response = await fetch("/v1/coach/turn", {
    method: "POST",
    headers: headers(),
    body,
    signal: input.signal,
  });
  const payload = (await response.json().catch(() => ({}))) as CoachTurnResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "omni_failed");
  }
  return payload;
}

export async function playBase64Audio(audioBase64: string, mime = "audio/wav"): Promise<void> {
  const bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
  });
  URL.revokeObjectURL(url);
}
