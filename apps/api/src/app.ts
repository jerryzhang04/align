import { createHash } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { coachTurnMetaSchema, guidanceReportSchema, scanGuidanceMetaSchema, type ModelGuidanceDraft } from "@align/contracts";
import { attachCoachVoice } from "./coachVoice.js";
import { runGuidanceAnalysis, runGuidanceSpeech, type GuidanceModelInput } from "./guidanceModel.js";
import { validateGuidanceDraft } from "./guidancePolicy.js";
import { ALLOWED_AUDIO, ALLOWED_IMAGE, LIMITS } from "./limits.js";
import { runOmniTurn } from "./omni.js";
import { resolveProviderConfig, type ProviderConfig } from "./provider.js";

type Dependencies = {
  provider?: () => ProviderConfig;
  analyze?: (input: GuidanceModelInput, config: ProviderConfig, signal: AbortSignal) => Promise<ModelGuidanceDraft>;
  speak?: (narration: string, config: ProviderConfig, signal: AbortSignal) => Promise<{ audioBase64?: string; audioMime?: string }>;
};

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
  const provider = dependencies.provider ?? (() => resolveProviderConfig(process.env));
  const analyze = dependencies.analyze ?? runGuidanceAnalysis;
  const speak = dependencies.speak ?? runGuidanceSpeech;

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
      const draft = await analyze({
        requestId: meta.requestId,
        scanId: meta.scanId,
        images,
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
        measurements: meta.measurements,
        captureNotes: meta.captureNotes ?? [],
        locale: meta.locale,
      }, config, signal);
      const core = validateGuidanceDraft(draft);
      const voice = await speak(narration(core), config, signal);
      const report = guidanceReportSchema.parse({
        requestId: meta.requestId,
        ...core,
        ...voice,
        speechProvider: voice.audioBase64 && config.mode === "omni" ? "omni" : "none",
        providerMode: config.mode,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        degraded: config.nativeAudioExpected && !voice.audioBase64 ? true : undefined,
      });
      console.info("guidance_report", meta.requestId, config.mode, config.model, report.latencyMs, report.speechProvider);
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
      const result = attachCoachVoice(await runOmniTurn({
        requestId: meta.requestId,
        stage: meta.stage,
        measurementsJson: JSON.stringify(meta.measurements),
        captureNotes: meta.captureNotes ?? [],
        imageBase64: Buffer.from(await image.arrayBuffer()).toString("base64"),
        imageMime: image.type,
        audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        audioFormat: audio.type,
      }, controller.signal));
      return c.json({ requestId: meta.requestId, ...result });
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
