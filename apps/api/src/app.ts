import { createHash } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { VIEWS, coachTurnMetaSchema, guidanceReportSchema, liveFinalizeMetaSchema, liveFrameMetaSchema, poseMeasureMetaSchema, scanGuidanceMetaSchema, type ModelGuidanceDraft, type ViewId } from "@align/contracts";
import { attachCoachVoice } from "./coachVoice.js";
import { runGuidanceAnalysis, runGuidanceSpeech, type GuidanceModelInput } from "./guidanceModel.js";
import { validateGuidanceDraft } from "./guidancePolicy.js";
import { ALLOWED_AUDIO, ALLOWED_IMAGE, LIMITS } from "./limits.js";
import { LiveSessionStore } from "./liveSession.js";
import { measurePoseImages, type PoseImage, type ScanPoseResult } from "./measureScan.js";
import { runOmniTurn } from "./omni.js";
import { resolveProviderConfig, type ProviderConfig } from "./provider.js";

type Dependencies = {
  provider?: () => ProviderConfig;
  analyze?: (input: GuidanceModelInput, config: ProviderConfig, signal: AbortSignal) => Promise<ModelGuidanceDraft>;
  speak?: (narration: string, config: ProviderConfig, signal: AbortSignal) => Promise<{ audioBase64?: string; audioMime?: string }>;
  measureScan?: (images: PoseImage[]) => Promise<ScanPoseResult>;
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
    if ((!ALLOWED_AUDIO.has(audio.type) && !audio.type.startsWith("audio/")) || audio.size > LIMITS.audioBytes) {
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
      const draft = await analyze({
        requestId: meta.requestId,
        scanId,
        images: samples.map((sample) => ({ view: sample.view, base64: sample.imageBase64, mime: sample.imageMime })),
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
        measurements: pose.measurements,
        captureNotes: [
          "Continuous live camera scan; labels represent temporal scan phases.",
          pose.source === "none" ? "Pose landmarks were unavailable for this scan." : `Pose source ${pose.source}.`,
          ...(meta.captureNotes ?? []),
        ],
        locale: meta.locale,
      }, config, signal);
      const core = validateGuidanceDraft(draft, pose.measurements);
      const voice = await speak(narration(core), config, signal).catch((error) => {
        if (controller.signal.aborted) throw error;
        console.warn("guidance_speech_unavailable", meta.requestId);
        return {} as { audioBase64?: string; audioMime?: string };
      });
      const report = guidanceReportSchema.parse({
        requestId: meta.requestId,
        ...core,
        measurements: pose.measurements,
        pose: { source: pose.source, viewsWithPose: pose.viewsWithPose },
        ...voice,
        speechProvider: voice.audioBase64 && config.mode === "omni" ? "omni" : "none",
        providerMode: config.mode,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        degraded: config.nativeAudioExpected && !voice.audioBase64 ? true : undefined,
      });
      console.info("live_guidance_report", meta.requestId, config.mode, config.model, report.latencyMs, report.speechProvider);
      liveSessions.close(scanId);
      return c.json(report);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "guidance_failed";
      if (name === "GuidanceConfigError") return c.json({ error: "guidance_not_configured", requestId: meta.requestId }, 503);
      if (name === "AbortError" || signal.aborted) return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      if (name === "GuidanceModelResponseError" || ["forbidden_medical_claim", "invented_numeric_finding", "unknown_evidence_source", "unknown_safety_signal"].includes(message)) {
        return c.json({ error: "guidance_invalid", requestId: meta.requestId }, 502);
      }
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
    if ((!ALLOWED_AUDIO.has(audio.type) && !audio.type.startsWith("audio/")) || audio.size > LIMITS.audioBytes) {
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
      const draft = await analyze({
        requestId: meta.requestId,
        scanId: meta.scanId,
        images,
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
        measurements: pose.measurements,
        captureNotes: [
          ...(meta.captureNotes ?? []),
          pose.source === "none" ? "Pose landmarks were unavailable for this scan." : `Pose source ${pose.source}.`,
        ],
        locale: meta.locale,
      }, config, signal);
      const core = validateGuidanceDraft(draft, pose.measurements);
      const voice = await speak(narration(core), config, signal).catch((error) => {
        if (controller.signal.aborted) throw error;
        console.warn("guidance_speech_unavailable", meta.requestId);
        return {} as { audioBase64?: string; audioMime?: string };
      });
      const report = guidanceReportSchema.parse({
        requestId: meta.requestId,
        ...core,
        measurements: pose.measurements,
        pose: { source: pose.source, viewsWithPose: pose.viewsWithPose },
        ...voice,
        speechProvider: voice.audioBase64 && config.mode === "omni" ? "omni" : "none",
        providerMode: config.mode,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        degraded: config.nativeAudioExpected && !voice.audioBase64 ? true : undefined,
      });
      console.info("guidance_report", meta.requestId, config.mode, config.model, report.latencyMs, report.speechProvider);
      liveSessions.close(meta.scanId);
      return c.json(report);
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "guidance_failed";
      if (name === "GuidanceConfigError") return c.json({ error: "guidance_not_configured", requestId: meta.requestId }, 503);
      if (name === "AbortError" || signal.aborted) return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      if (name === "GuidanceModelResponseError" || ["forbidden_medical_claim", "invented_numeric_finding", "unknown_evidence_source", "unknown_safety_signal"].includes(message)) {
        console.warn("guidance_invalid", meta.requestId, name || "Error", message);
        return c.json({ error: "guidance_invalid", requestId: meta.requestId }, 502);
      }
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
    if ((!ALLOWED_AUDIO.has(audio.type) && !audio.type.startsWith("audio/")) || audio.size > LIMITS.audioBytes) return c.json({ error: "invalid_audio" }, 400);
    activeTurns.get(meta.scanId)?.abort();
    const controller = new AbortController();
    activeTurns.set(meta.scanId, controller);
    try {
      const imageBytes = Buffer.from(await image.arrayBuffer());
      const stage = (VIEWS as readonly string[]).includes(meta.stage) ? meta.stage as ViewId : "front";
      const pose = await measureScan([{ view: stage, bytes: imageBytes }]);
      const result = attachCoachVoice(await runOmniTurn({
        requestId: meta.requestId,
        stage: meta.stage,
        measurementsJson: JSON.stringify(pose.measurements),
        captureNotes: [
          ...(meta.captureNotes ?? []),
          pose.source === "none" ? "Pose landmarks were unavailable for this frame." : `Pose source ${pose.source}.`,
        ],
        imageBase64: imageBytes.toString("base64"),
        imageMime: image.type,
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
      }, controller.signal));
      return c.json({ requestId: meta.requestId, ...result, measurements: pose.measurements });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const message = error instanceof Error ? error.message : "omni_failed";
      if (name === "OmniConfigError") return c.json({ error: "omni_not_configured", requestId: meta.requestId }, 503);
      if (name === "AbortError") return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
      console.error("omni_turn_failed", meta.requestId, message);
      return c.json({ error: "omni_failed", requestId: meta.requestId }, 502);
    } finally {
      if (activeTurns.get(meta.scanId) === controller) activeTurns.delete(meta.scanId);
    }
  });

  return app;
}
