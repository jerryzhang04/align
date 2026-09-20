import {
  coachTurnResponseSchema,
  guidanceReportSchema,
  healthResponseSchema,
  type CoachTurnResponse,
  type GuidanceReport,
  type HealthResponse,
  type ViewId,
} from "@align/contracts";
import type { Captures } from "../lib/captureFlow";

const apiUrl = (process.env.EXPO_PUBLIC_ALIGN_API_URL ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const apiToken = process.env.EXPO_PUBLIC_ALIGN_API_TOKEN ?? "";

function headers() {
  return apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined;
}

export async function checkCoachHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/v1/health`, { signal, headers: headers() });
  if (!response.ok) throw new Error("coach_unavailable");
  return healthResponseSchema.parse(await response.json());
}

export async function askCoach(input: {
  requestId: string;
  scanId: string;
  stage: ViewId;
  imageUri: string;
  audioUri: string;
  signal?: AbortSignal;
}): Promise<CoachTurnResponse> {
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    stage: input.stage,
    measurements: [],
    captureNotes: ["Native guided capture; numeric native pose measurements are not connected yet."],
  }));
  form.append("image", { uri: input.imageUri, name: "coach-frame.jpg", type: "image/jpeg" } as unknown as Blob);
  form.append("audio", { uri: input.audioUri, name: "question.m4a", type: "audio/mp4" } as unknown as Blob);

  const response = await fetch(`${apiUrl}/v1/coach/turn`, {
    method: "POST",
    body: form,
    headers: headers(),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : "coach_failed";
    throw new Error(code);
  }
  return coachTurnResponseSchema.parse(payload);
}

export async function requestGuidance(input: {
  requestId: string;
  scanId: string;
  captures: Captures;
  audioUri: string;
  signal?: AbortSignal;
}): Promise<GuidanceReport> {
  const form = new FormData();
  form.append("meta", JSON.stringify({
    requestId: input.requestId,
    scanId: input.scanId,
    views: ["front", "right", "back", "left"],
    measurements: [],
    captureNotes: ["Native four-view guided capture; verified numeric pose measurements are not connected yet."],
    locale: "en-CA",
  }));
  for (const view of ["front", "right", "back", "left"] as const) {
    const uri = input.captures[view];
    if (!uri) throw new Error("missing_capture");
    form.append(view, { uri, name: `${view}.jpg`, type: "image/jpeg" } as unknown as Blob);
  }
  form.append("audio", { uri: input.audioUri, name: "goal.m4a", type: "audio/mp4" } as unknown as Blob);
  const response = await fetch(`${apiUrl}/v1/guidance/report`, {
    method: "POST",
    body: form,
    headers: headers(),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "guidance_failed");
  return guidanceReportSchema.parse(payload);
}
