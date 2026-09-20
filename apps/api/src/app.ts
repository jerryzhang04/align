import { createHash } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { VIEWS, coachTurnMetaSchema, guidanceReportSchema, liveFinalizeMetaSchema, liveFrameMetaSchema, poseMeasureMetaSchema, posePreviewMetaSchema, scanGuidanceMetaSchema, type ModelGuidanceDraft, type ViewId } from "@align/contracts";
import { practiceProfile, practiceScoreInts, type PoseFrame } from "@align/metrics";
import { attachCoachVoice } from "./coachVoice.js";
import { runGuidanceAnalysis, runGuidanceSpeech, type GuidanceModelInput } from "./guidanceModel.js";
import { validateGuidanceDraft } from "./guidancePolicy.js";
import { ALLOWED_IMAGE, LIMITS, acceptableAudio } from "./limits.js";
import { LiveSessionStore } from "./liveSession.js";
import { localCoachText, localWellnessCore } from "./localGuidance.js";
import { measurePoseImages, type PoseImage, type ScanPoseResult } from "./measureScan.js";
import { runOmniTurn } from "./omni.js";
import { previewStanceFromJpeg, type StancePreview } from "./posePreview.js";
import { resolveProviderConfig, type ProviderConfig } from "./provider.js";

type Dependencies = {
  provider?: () => ProviderConfig;
  analyze?: (input: GuidanceModelInput, config: ProviderConfig, signal: AbortSignal) => Promise<ModelGuidanceDraft>;
  speak?: (narration: string, config: ProviderConfig, signal: AbortSignal) => Promise<{ audioBase64?: string; audioMime?: string }>;
  measureScan?: (images: PoseImage[]) => Promise<ScanPoseResult>;
  previewStance?: (bytes: Uint8Array, view: ViewId, previous: PoseFrame | null) => Promise<StancePreview>;
};

function livePoseImages(store: LiveSessionStore, scanId: string): PoseImage[] {
  const grouped = store.listByView(scanId);
  return VIEWS.flatMap((view) => grouped[view].map((sample) => ({
    view,
    bytes: Buffer.from(sample.imageBase64, "base64"),
  })));
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function clientKey(header: string | undefined) {
  const token = bearer(header);
  return token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : "local";
}

function narration(core: ReturnType<typeof validateGuidanceDraft>) {
  return [
    core.safety.level === "wellness" ? "" : core.safety.message,
    core.summary,
    ...core.actions.map((action) => `${action.title}. ${action.instruction}`),
  ].filter(Boolean).join(" ");
}

function assembleGuidanceReport(input: {
  requestId: string;
  core: ReturnType<typeof validateGuidanceDraft>;
  pose: ScanPoseResult;
  voice: { audioBase64?: string; audioMime?: string };
  config: ProviderConfig;
  startedAt: number;
  degraded?: boolean;
}) {
  const scores = practiceProfile(input.pose.measurements);
  return guidanceReportSchema.parse({
    requestId: input.requestId,
    ...input.core,
    measurements: input.pose.measurements,
    pose: { source: input.pose.source, viewsWithPose: input.pose.viewsWithPose },
    practiceScores: scores.areas.length ? scores : null,
    ...input.voice,
    speechProvider: input.voice.audioBase64 && input.config.mode === "omni" ? "omni" : "none",
    providerMode: input.config.mode,
    model: input.config.mode === "omni" ? input.config.model : "local-evidence",
    latencyMs: Date.now() - input.startedAt,
    degraded: input.degraded || (input.config.nativeAudioExpected && !input.voice.audioBase64) || undefined,
  });
}

export function createApp(dependencies: Dependencies = {}) {
  const app = new Hono();
  const activeTurns = new Map<string, AbortController>();
  const recentTurns = new Map<string, number[]>();
  const recentFrames = new Map<string, number[]>();
  const liveSessions = new LiveSessionStore();
  const provider = dependencies.provider ?? (() => resolveProviderConfig(process.env));
  const analyze = dependencies.analyze ?? runGuidanceAnalysis;
  const speak = dependencies.speak ?? runGuidanceSpeech;
  const measureScan = dependencies.measureScan ?? measurePoseImages;
  const previewFrames = new Map<string, PoseFrame>();
  const previewStance = dependencies.previewStance ?? (async (bytes: Uint8Array, view: ViewId, previous: PoseFrame | null) => {
    const { estimatePoseFromJpeg } = await import("./poseEstimate.js");
    return previewStanceFromJpeg(bytes, view, previous, estimatePoseFromJpeg);
  });
  const recentPreviews = new Map<string, number[]>();

  async function produceGuidance(input: {
    requestId: string;
    scanId: string;
    images: GuidanceModelInput["images"];
    audioBase64: string;
    audioFormat: string;
    captureNotes: string[];
    locale: string;
    pose: ScanPoseResult;
    config: ProviderConfig;
    signal: AbortSignal;
    startedAt: number;
  }) {
    try {
      const scores = practiceProfile(input.pose.measurements);
      const draft = await analyze({
        requestId: input.requestId,
        scanId: input.scanId,
        images: input.images,
        audioBase64: input.audioBase64,
        audioFormat: input.audioFormat,
        measurements: input.pose.measurements,
        practiceScores: scores.areas.length ? scores : null,
        captureNotes: input.captureNotes,
        locale: input.locale,
      }, input.config, input.signal);
      const core = validateGuidanceDraft(draft, input.pose.measurements, practiceScoreInts(scores));
      const voice = await speak(narration(core), input.config, input.signal).catch((error) => {
        if (input.signal.aborted) throw error;
        console.warn("guidance_speech_unavailable", input.requestId);
        return {} as { audioBase64?: string; audioMime?: string };
      });
      return assembleGuidanceReport({
        requestId: input.requestId,
        core,
        pose: input.pose,
        voice,
        config: input.config,
        startedAt: input.startedAt,
      });
    } catch (error) {
      if ((error instanceof Error && error.name === "AbortError") || input.signal.aborted) throw error;
      console.warn("guidance_fallback_local", input.requestId, error instanceof Error ? error.message : error);
      return assembleGuidanceReport({
        requestId: input.requestId,
        core: localWellnessCore(input.pose.measurements),
        pose: input.pose,
        voice: {},
        config: { ...input.config, mode: "unconfigured", nativeAudioExpected: false },
        startedAt: input.startedAt,
        degraded: true,
      });
    }
  }

  app.use("/*", cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }));

  const authorized = (header: string | undefined) => {
    const required = (process.env.ALIGN_API_TOKEN ?? "").trim();
    return !required || bearer(header) === required;
  };

  const limited = (key: string) => {
    const now = Date.now();
    const recent = (recentTurns.get(key) ?? []).filter((time) => now - time <= 60_000);
    if (recent.length >= 12) return true;
    recent.push(now);
    recentTurns.set(key, recent);
    return false;
  };

  const frameLimited = (key: string) => {
    const now = Date.now();
    const recent = (recentFrames.get(key) ?? []).filter((time) => now - time <= 60_000);
    if (recent.length >= 120) return true;
    recent.push(now);
    recentFrames.set(key, recent);
    return false;
  };

  const previewLimited = (key: string) => {
    const now = Date.now();
    const recent = (recentPreviews.get(key) ?? []).filter((time) => now - time <= 60_000);
    if (recent.length >= 180) return true;
    recent.push(now);
    recentPreviews.set(key, recent);
    return false;
  };

  app.get("/v1/health", (c) => {
    const config = provider();
    return c.json({
      ok: true,
      omniConfigured: config.mode === "omni",
      guidanceConfigured: config.configured,
      providerMode: config.mode,
      provider: config.provider,
      model: config.configured ? config.model : null,
      nativeAudioExpected: config.nativeAudioExpected,
    });
  });

  app.post("/v1/live/sessions/:scanId/frames", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (frameLimited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);
    const scanId = decodeURIComponent(c.req.param("scanId"));
    if (!scanId || scanId.length > 80) return c.json({ error: "invalid_scan_id" }, 400);
    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    const image = body.image;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) return c.json({ error: "invalid_meta" }, 400);
    let meta;
    try {
      meta = liveFrameMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }
    if (!(image instanceof File)) return c.json({ error: "missing_media", requestId: meta.requestId }, 400);
    if (image.type !== "image/jpeg" || image.size > LIMITS.imageBytes) return c.json({ error: "invalid_image", requestId: meta.requestId }, 400);
    let result;
    try {
      result = liveSessions.addFrame({
        scanId,
        timestampMs: meta.capturedAtMs,
        imageBase64: Buffer.from(await image.arrayBuffer()).toString("base64"),
        imageMime: image.type,
        view: meta.view,
        orientation: meta.orientation,
        fingerprint: meta.fingerprint,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "live_session_not_accepting") {
        return c.json({ error: "live_session_closed", requestId: meta.requestId }, 409);
      }
      throw error;
    }
    return c.json({ requestId: meta.requestId, ...result }, 202);
  });

  app.delete("/v1/live/sessions/:scanId", (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    const scanId = decodeURIComponent(c.req.param("scanId"));
    if (!scanId || scanId.length > 80) return c.json({ error: "invalid_scan_id" }, 400);
    activeTurns.get(scanId)?.abort();
    activeTurns.delete(scanId);
    liveSessions.close(scanId);
    previewFrames.delete(scanId);
    return c.body(null, 204);
  });

  app.post("/v1/live/sessions/:scanId/finalize", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (limited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);
    const scanId = decodeURIComponent(c.req.param("scanId"));
    if (!scanId || scanId.length > 80) return c.json({ error: "invalid_scan_id" }, 400);
    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    const audio = body.audio;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) return c.json({ error: "invalid_meta" }, 400);
    let meta;
    try {
      meta = liveFinalizeMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }
    if (!(audio instanceof File)) return c.json({ error: "missing_media", requestId: meta.requestId }, 400);
    if (!acceptableAudio(audio)) {
      return c.json({ error: "invalid_audio", requestId: meta.requestId }, 400);
    }
    const samples = liveSessions.selectLatestByView(scanId, VIEWS);
    if (samples.length < 4) return c.json({ error: "missing_live_frames", requestId: meta.requestId }, 400);
    const poseInputs = livePoseImages(liveSessions, scanId);
    if (!liveSessions.beginFinalize(scanId)) return c.json({ error: "live_session_busy", requestId: meta.requestId }, 409);

    activeTurns.get(scanId)?.abort();
    const controller = new AbortController();
    activeTurns.set(scanId, controller);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(LIMITS.timeoutMs)]);
    const startedAt = Date.now();
    const config = provider();
    try {
      const pose = await measureScan(poseInputs);
      const report = await produceGuidance({
        requestId: meta.requestId,
        scanId,
        images: samples.map((sample) => ({ view: sample.view, base64: sample.imageBase64, mime: sample.imageMime })),
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
        captureNotes: [
          "Continuous live camera scan; labels represent temporal scan phases.",
          pose.source === "none" ? "Pose landmarks were unavailable for this scan." : `Pose source ${pose.source}.`,
          ...(meta.captureNotes ?? []),
        ],
        locale: meta.locale,
        pose,
        config,
        signal,
        startedAt,
      });
      console.info("live_guidance_report", meta.requestId, report.providerMode, report.model, report.latencyMs, report.speechProvider);
      liveSessions.close(scanId);
      return c.json(report);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError" || signal.aborted) return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      const message = error instanceof Error ? error.message : "guidance_failed";
      console.error("live_guidance_failed", meta.requestId, config.mode, name || "Error", message);
      return c.json({ error: "guidance_failed", requestId: meta.requestId }, 502);
    } finally {
      liveSessions.reopen(scanId);
      if (activeTurns.get(scanId) === controller) activeTurns.delete(scanId);
    }
  });

  app.post("/v1/guidance/report", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (limited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);

    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) {
      return c.json({ error: "invalid_meta" }, 400);
    }
    let meta;
    try {
      meta = scanGuidanceMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }

    const files = meta.views.map((view) => ({ view, file: body[view] }));
    const audio = body.audio;
    if (files.some(({ file }) => !(file instanceof File)) || !(audio instanceof File)) {
      return c.json({ error: "missing_media", requestId: meta.requestId }, 400);
    }
    if (files.some(({ file }) => {
      const image = file as File;
      return !ALLOWED_IMAGE.has(image.type) || image.size > LIMITS.imageBytes;
    })) return c.json({ error: "invalid_image", requestId: meta.requestId }, 400);
    if (!acceptableAudio(audio)) {
      return c.json({ error: "invalid_audio", requestId: meta.requestId }, 400);
    }

    activeTurns.get(meta.scanId)?.abort();
    const controller = new AbortController();
    activeTurns.set(meta.scanId, controller);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(LIMITS.timeoutMs)]);
    const startedAt = Date.now();
    const config = provider();
    try {
      const images = await Promise.all(files.map(async ({ view, file }) => ({
        view,
        base64: Buffer.from(await (file as File).arrayBuffer()).toString("base64"),
        mime: (file as File).type,
      })));
      const pose = await measureScan([
        ...livePoseImages(liveSessions, meta.scanId),
        ...images.map((image) => ({ view: image.view, bytes: Buffer.from(image.base64, "base64") })),
      ]);
      const report = await produceGuidance({
        requestId: meta.requestId,
        scanId: meta.scanId,
        images,
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
        captureNotes: [
          ...(meta.captureNotes ?? []),
          pose.source === "none" ? "Pose landmarks were unavailable for this scan." : `Pose source ${pose.source}.`,
        ],
        locale: meta.locale,
        pose,
        config,
        signal,
        startedAt,
      });
      console.info("guidance_report", meta.requestId, report.providerMode, report.model, report.latencyMs, report.speechProvider);
      liveSessions.close(meta.scanId);
      return c.json(report);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError" || signal.aborted) return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      const message = error instanceof Error ? error.message : "guidance_failed";
      console.error("guidance_failed", meta.requestId, config.mode, name || "Error", message);
      return c.json({ error: "guidance_failed", requestId: meta.requestId }, 502);
    } finally {
      if (activeTurns.get(meta.scanId) === controller) activeTurns.delete(meta.scanId);
    }
  });

  app.post("/v1/pose/measure", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (limited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);

    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) {
      return c.json({ error: "invalid_meta" }, 400);
    }
    let meta;
    try {
      meta = poseMeasureMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }

    const files = meta.views.map((view) => ({ view, file: body[view] }));
    if (files.some(({ file }) => !(file instanceof File))) {
      return c.json({ error: "missing_media", requestId: meta.requestId }, 400);
    }
    if (files.some(({ file }) => {
      const image = file as File;
      return !ALLOWED_IMAGE.has(image.type) || image.size > LIMITS.imageBytes;
    })) return c.json({ error: "invalid_image", requestId: meta.requestId }, 400);

    try {
      const uploaded = await Promise.all(files.map(async ({ view, file }) => ({
        view,
        bytes: Buffer.from(await (file as File).arrayBuffer()),
      })));
      const pose = await measureScan([
        ...livePoseImages(liveSessions, meta.scanId),
        ...uploaded,
      ]);
      return c.json({
        requestId: meta.requestId,
        measurements: pose.measurements,
        pose: { source: pose.source, viewsWithPose: pose.viewsWithPose },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "pose_failed";
      console.error("pose_measure_failed", meta.requestId, message);
      return c.json({ error: "pose_failed", requestId: meta.requestId }, 502);
    }
  });

  app.post("/v1/pose/preview", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (previewLimited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);
    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    const image = body.image;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) return c.json({ error: "invalid_meta" }, 400);
    let meta;
    try {
      meta = posePreviewMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }
    if (!(image instanceof File)) return c.json({ error: "missing_media", requestId: meta.requestId }, 400);
    if (!ALLOWED_IMAGE.has(image.type) || image.size > LIMITS.imageBytes) {
      return c.json({ error: "invalid_image", requestId: meta.requestId }, 400);
    }
    try {
      const previous = previewFrames.get(meta.scanId) ?? null;
      const result = await previewStance(Buffer.from(await image.arrayBuffer()), meta.view, previous);
      if (result.frame) previewFrames.set(meta.scanId, result.frame);
      return c.json({
        requestId: meta.requestId,
        aligned: result.aligned,
        still: result.still,
        pose: result.pose,
        issues: result.issues,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "pose_failed";
      console.error("pose_preview_failed", meta.requestId, message);
      return c.json({ error: "pose_failed", requestId: meta.requestId }, 502);
    }
  });

  app.post("/v1/coach/turn", async (c) => {
    const authorization = c.req.header("Authorization");
    if (!authorized(authorization)) return c.json({ error: "unauthorized" }, 401);
    if (limited(clientKey(authorization))) return c.json({ error: "rate_limited" }, 429);
    const body = await c.req.parseBody({ all: true });
    const metaField = body.meta;
    if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) return c.json({ error: "invalid_meta" }, 400);
    let meta;
    try {
      meta = coachTurnMetaSchema.parse(JSON.parse(metaField));
    } catch {
      return c.json({ error: "invalid_meta" }, 400);
    }
    const image = body.image;
    const audio = body.audio;
    if (!(image instanceof File) || !(audio instanceof File)) return c.json({ error: "missing_media" }, 400);
    if (!ALLOWED_IMAGE.has(image.type) || image.size > LIMITS.imageBytes) return c.json({ error: "invalid_image" }, 400);
    if (!acceptableAudio(audio)) return c.json({ error: "invalid_audio" }, 400);
    activeTurns.get(meta.scanId)?.abort();
    const controller = new AbortController();
    activeTurns.set(meta.scanId, controller);
    const config = provider();
    try {
      const imageBytes = Buffer.from(await image.arrayBuffer());
      const stage = (VIEWS as readonly string[]).includes(meta.stage) ? meta.stage as ViewId : "front";
      const pose = await measureScan([{ view: stage, bytes: imageBytes }]);
      const scores = practiceProfile(pose.measurements);
      try {
        const result = attachCoachVoice(await runOmniTurn({
          requestId: meta.requestId,
          stage: meta.stage,
          measurementsJson: JSON.stringify({
            measurements: pose.measurements,
            practiceScores: scores.areas.length ? scores : null,
          }),
          captureNotes: [
            ...(meta.captureNotes ?? []),
            pose.source === "none" ? "Pose landmarks were unavailable for this frame." : `Pose source ${pose.source}.`,
          ],
          imageBase64: imageBytes.toString("base64"),
          imageMime: image.type,
          audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
          audioFormat: audio.type,
        }, controller.signal), config.mode);
        return c.json({ requestId: meta.requestId, ...result, measurements: pose.measurements });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        console.warn("omni_turn_fallback_local", meta.requestId, error instanceof Error ? error.message : error);
        const result = attachCoachVoice({
          text: localCoachText(pose.measurements),
          model: "local-evidence",
          degraded: true,
        }, "unconfigured");
        return c.json({ requestId: meta.requestId, ...result, measurements: pose.measurements });
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      const message = error instanceof Error ? error.message : "omni_failed";
      console.error("omni_turn_failed", meta.requestId, message);
      return c.json({ error: "omni_failed", requestId: meta.requestId }, 502);
    } finally {
      if (activeTurns.get(meta.scanId) === controller) activeTurns.delete(meta.scanId);
    }
  });

  return app;
}
