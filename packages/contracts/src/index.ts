import { z } from "zod";

export const DEFINITION_VERSION = "2026-09-19.1";
export const POSE_SCHEMA = "mediapipe.pose_landmarker.33";

export const VIEWS = ["front", "right", "back", "left"] as const;
export type ViewId = (typeof VIEWS)[number];

export const MEASUREMENT_IDS = [
  "shoulder_line_tilt",
  "head_line_tilt",
  "head_shoulder_offset",
  "trunk_lean",
  "knee_flexion",
  "frontal_knee_alignment",
  "arm_elevation",
] as const;
export type MeasurementId = (typeof MEASUREMENT_IDS)[number];

export const measurementSchema = z.object({
  id: z.string(),
  value: z.number(),
  unit: z.enum(["deg", "ratio", "seconds"]),
  view: z.enum(VIEWS),
  definitionVersion: z.string(),
  sampleCount: z.number().int().nonnegative(),
  quality: z.enum(["usable", "limited"]),
  limitations: z.array(z.string()),
});
export type Measurement = z.infer<typeof measurementSchema>;

export const coachTurnMetaSchema = z.object({
  requestId: z.string().min(1).max(80),
  scanId: z.string().min(1).max(80),
  stage: z.string().min(1).max(80),
  measurements: z.array(measurementSchema).max(40),
  captureNotes: z.array(z.string().max(240)).max(12).optional(),
});
export type CoachTurnMeta = z.infer<typeof coachTurnMetaSchema>;

export const coachTurnResponseSchema = z.object({
  requestId: z.string(),
  text: z.string(),
  audioBase64: z.string().optional(),
  audioMime: z.string().optional(),
  model: z.string().optional(),
  degraded: z.boolean().optional(),
  limitations: z.array(z.string()).optional(),
});
export type CoachTurnResponse = z.infer<typeof coachTurnResponseSchema>;

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  omniConfigured: z.boolean(),
  model: z.string().nullable(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
