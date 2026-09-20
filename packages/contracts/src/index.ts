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
  speechProvider: z.enum(["omni", "none"]),
  limitations: z.array(z.string()).optional(),
});
export type CoachTurnResponse = z.infer<typeof coachTurnResponseSchema>;

export const providerModeSchema = z.enum(["omni", "unconfigured"]);
export type ProviderMode = z.infer<typeof providerModeSchema>;

export const evidenceLevelSchema = z.enum(["guideline", "systematic-review", "occupational-guidance"]);
export const safetyLevelSchema = z.enum(["wellness", "seek-professional-care", "urgent-care"]);

export const evidenceCitationSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(240),
  publisher: z.string().min(1).max(160),
  url: z.string().url(),
  level: evidenceLevelSchema,
  reviewedAt: z.string().min(10).max(10),
});
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;

export const guidanceObservationSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  basedOnViews: z.array(z.enum(VIEWS)).min(1).max(4),
  limitations: z.array(z.string().min(1).max(300)).max(4),
});

export const guidanceActionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  instruction: z.string().min(1).max(500),
  rationale: z.string().min(1).max(500),
  sourceIds: z.array(z.string().min(1).max(80)).min(1).max(5),
});

export const modelGuidanceDraftSchema = z.object({
  summary: z.string().min(1).max(700),
  observations: z.array(guidanceObservationSchema).max(3),
  actions: z.array(guidanceActionSchema).max(3),
  limitations: z.array(z.string().min(1).max(300)).max(8),
  safetySignalIds: z.array(z.string().min(1).max(80)).max(8),
});
export type ModelGuidanceDraft = z.infer<typeof modelGuidanceDraftSchema>;

export const scanGuidanceMetaSchema = z.object({
  requestId: z.string().min(1).max(80),
  scanId: z.string().min(1).max(80),
  views: z.tuple([z.literal("front"), z.literal("right"), z.literal("back"), z.literal("left")]),
  measurements: z.array(measurementSchema).max(40),
  captureNotes: z.array(z.string().max(240)).max(12).optional(),
  locale: z.string().min(2).max(20).default("en-CA"),
});
export type ScanGuidanceMeta = z.infer<typeof scanGuidanceMetaSchema>;

export const guidanceReportSchema = z.object({
  requestId: z.string(),
  summary: z.string(),
  observations: z.array(guidanceObservationSchema),
  actions: z.array(guidanceActionSchema),
  limitations: z.array(z.string()),
  safety: z.object({
    level: safetyLevelSchema,
    message: z.string(),
    signalIds: z.array(z.string()),
  }),
  sources: z.array(evidenceCitationSchema),
  audioBase64: z.string().optional(),
  audioMime: z.string().optional(),
  speechProvider: z.enum(["omni", "none"]),
  providerMode: providerModeSchema,
  model: z.string(),
  latencyMs: z.number().nonnegative(),
  degraded: z.boolean().optional(),
});
export type GuidanceReport = z.infer<typeof guidanceReportSchema>;

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  omniConfigured: z.boolean(),
  guidanceConfigured: z.boolean(),
  providerMode: providerModeSchema,
  provider: z.literal("yibu").nullable(),
  model: z.string().nullable(),
  nativeAudioExpected: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
