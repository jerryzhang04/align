import { File } from "expo-file-system";
import { guidanceReportSchema, type GuidanceReport, type Measurement, type ViewId } from "@align/contracts";
import { runtimeCoachApi } from "./runtimeCoachApi";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type ClientOptions = {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
};

type Orientation = { yaw?: number; pitch?: number; roll?: number };

type UploadFrameInput = {
  scanId: string;
  requestId: string;
  capturedAtMs: number;
  view: ViewId;
  imageUri: string;
  orientation?: Orientation;
  signal?: AbortSignal;
};

type FinalizeInput = {
  scanId: string;
  requestId: string;
  audioUri: string;
  measurements?: Measurement[];
  captureNotes?: string[];
  locale?: string;
  signal?: AbortSignal;
};

function serverError(payload: unknown, fallback: string): Error {
  const code = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
  return new Error(code);
}

export function createLiveCoachClient({ baseUrl, token, fetchImpl = fetch }: ClientOptions) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = () => token ? { Authorization: `Bearer ${token}` } : undefined;
  const sessionUrl = (scanId: string, action: "frames" | "finalize") => `${root}/v1/live/sessions/${encodeURIComponent(scanId)}/${action}`;

  return {
    async uploadFrame(input: UploadFrameInput) {
      const form = new FormData();
      form.append("meta", JSON.stringify({
        requestId: input.requestId,
        capturedAtMs: input.capturedAtMs,
        view: input.view,
        ...(input.orientation ? { orientation: input.orientation } : {}),
      }));
      form.append("image", new File(input.imageUri));
      const response = await fetchImpl(sessionUrl(input.scanId, "frames"), {
        method: "POST",
        body: form,
        headers: headers(),
        signal: input.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw serverError(payload, "live_frame_failed");
      return payload as { requestId: string; accepted: boolean; replaced: boolean; frameCount: number };
    },

    async finalize(input: FinalizeInput): Promise<GuidanceReport> {
      const form = new FormData();
      form.append("meta", JSON.stringify({
        requestId: input.requestId,
        measurements: input.measurements ?? [],
        captureNotes: input.captureNotes ?? [],
        locale: input.locale ?? "en-CA",
      }));
      form.append("audio", new File(input.audioUri));
      const response = await fetchImpl(sessionUrl(input.scanId, "finalize"), {
        method: "POST",
        body: form,
        headers: headers(),
        signal: input.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw serverError(payload, "live_guidance_failed");
      const parsed = guidanceReportSchema.safeParse(payload);
      if (!parsed.success) throw new Error("coach_invalid_response");
      return parsed.data;
    },

    async reset(scanId: string, signal?: AbortSignal): Promise<void> {
      const response = await fetchImpl(`${root}/v1/live/sessions/${encodeURIComponent(scanId)}`, {
        method: "DELETE",
        headers: headers(),
        signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw serverError(payload, "live_reset_failed");
      }
    },
  };
}

function defaultClient() {
  const { baseUrl, token } = runtimeCoachApi();
  return createLiveCoachClient({ baseUrl, token });
}

export const uploadLiveFrame: ReturnType<typeof createLiveCoachClient>["uploadFrame"] = (input) => defaultClient().uploadFrame(input);
export const finalizeLiveSession: ReturnType<typeof createLiveCoachClient>["finalize"] = (input) => defaultClient().finalize(input);
export const resetLiveSession: ReturnType<typeof createLiveCoachClient>["reset"] = (scanId, signal) => defaultClient().reset(scanId, signal);
