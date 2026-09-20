import { fetchWithTimeout } from "./request";
import { runtimeCoachApi } from "./runtimeCoachApi";
import {
  coachTurnResponseSchema,
  guidanceReportSchema,
  healthResponseSchema,
  poseMeasureResponseSchema,
  posePreviewResponseSchema,
  type CoachTurnResponse,
  type GuidanceReport,
  type HealthResponse,
  type PoseMeasureResponse,
  type PosePreviewResponse,
  type ViewId,
} from "@align/contracts";
import type { Captures } from "../lib/captureFlow";
import { recordingUpload } from "../lib/audioUpload";

function connection() {
  return runtimeCoachApi();
}

function headers(token: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function parseOk<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false } }, payload: unknown, code: string): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(code);
  return parsed.data;
}

export async function checkCoachHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const { baseUrl, token } = connection();
  const response = await fetchWithTimeout(`${baseUrl}/v1/health`, { signal, headers: headers(token) }, 5_000);
  if (!response.ok) throw new Error("coach_unavailable");
  return parseOk(healthResponseSchema, await response.json(), "coach_invalid_response");
}

export async function askCoach(input: {
  requestId: string;
  scanId: string;
  stage: ViewId;
  imageUri: string;
  audioUri: string;
  signal?: AbortSignal;
}): Promise<CoachTurnResponse> {
  const { baseUrl, token } = connection();
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    stage: input.stage,
    measurements: [],
    captureNotes: ["Native guided capture."],
  }));
  form.append("image", { uri: input.imageUri, name: "coach-frame.jpg", type: "image/jpeg" } as unknown as Blob);
  const audio = recordingUpload(input.audioUri);
  form.append("audio", { uri: input.audioUri, name: audio.name, type: audio.type } as unknown as Blob);

  const response = await fetchWithTimeout(`${baseUrl}/v1/coach/turn`, {
    method: "POST",
    body: form,
    headers: headers(token),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "coach_failed";
    throw new Error(code);
  }
  return parseOk(coachTurnResponseSchema, payload, "coach_invalid_response");
}

export async function requestGuidance(input: {
  requestId: string;
  scanId: string;
  captures: Captures;
  audioUri: string;
  signal?: AbortSignal;
}): Promise<GuidanceReport> {
  const { baseUrl, token } = connection();
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    views: ["front", "right", "back", "left"],
    measurements: [],
    captureNotes: ["Native four-view guided capture."],
    locale: "en-CA",
  }));
  for (const view of ["front", "right", "back", "left"] as const) {
    const uri = input.captures[view];
    if (!uri) throw new Error("missing_capture");
    form.append(view, { uri, name: `${view}.jpg`, type: "image/jpeg" } as unknown as Blob);
  }
  form.append("audio", { uri: input.audioUri, name: recordingUpload(input.audioUri).name, type: recordingUpload(input.audioUri).type } as unknown as Blob);
  const response = await fetchWithTimeout(`${baseUrl}/v1/guidance/report`, {
    method: "POST",
    body: form,
    headers: headers(token),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "guidance_failed");
  return parseOk(guidanceReportSchema, payload, "coach_invalid_response");
}

export async function requestPoseMeasurements(input: {
  requestId: string;
  scanId: string;
  captures: Captures;
  signal?: AbortSignal;
}): Promise<PoseMeasureResponse> {
  const { baseUrl, token } = connection();
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    views: ["front", "right", "back", "left"],
  }));
  for (const view of ["front", "right", "back", "left"] as const) {
    const uri = input.captures[view];
    if (!uri) throw new Error("missing_capture");
    form.append(view, { uri, name: `${view}.jpg`, type: "image/jpeg" } as unknown as Blob);
  }
  const response = await fetchWithTimeout(`${baseUrl}/v1/pose/measure`, {
    method: "POST",
    body: form,
    headers: headers(token),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "pose_failed");
  return parseOk(poseMeasureResponseSchema, payload, "coach_invalid_response");
}

export async function previewStance(input: {
  requestId: string;
  scanId: string;
  view: ViewId;
  imageUri: string;
  signal?: AbortSignal;
}): Promise<PosePreviewResponse> {
  const { baseUrl, token } = connection();
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    view: input.view,
  }));
  form.append("image", { uri: input.imageUri, name: "preview.jpg", type: "image/jpeg" } as unknown as Blob);
  const response = await fetchWithTimeout(`${baseUrl}/v1/pose/preview`, {
    method: "POST",
    body: form,
    headers: headers(token),
    signal: input.signal,
  }, 8_000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "pose_failed");
  return parseOk(posePreviewResponseSchema, payload, "coach_invalid_response");
}
