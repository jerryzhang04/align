import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { coachTurnMetaSchema } from "@align/contracts";
import { attachCoachVoice } from "./coachVoice.js";
import { loadEnv } from "./env.js";
import { ALLOWED_AUDIO, ALLOWED_IMAGE, LIMITS } from "./limits.js";
import { omniConfigured, omniModel, runOmniTurn } from "./omni.js";
import { resolveServerAddress } from "./serverConfig.js";

loadEnv();

const app = new Hono();
const activeTurns = new Map<string, AbortController>();
const recentTurns: number[] = [];

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function authorize(c: { req: { header: (name: string) => string | undefined } }): boolean {
  const required = (process.env.ALIGN_API_TOKEN ?? "").trim();
  if (!required) return true;
  return bearer(c.req.header("Authorization")) === required;
}

function rateLimited(session = "local"): boolean {
  const now = Date.now();
  while (recentTurns.length && now - recentTurns[0] > 60_000) recentTurns.shift();
  if (recentTurns.length >= 12) return true;
  recentTurns.push(now);
  void session;
  return false;
}

app.get("/v1/health", (c) => {
  return c.json({
    ok: true,
    omniConfigured: omniConfigured(),
    model: omniConfigured() ? omniModel() : null,
  });
});

app.post("/v1/coach/turn", async (c) => {
  if (!authorize(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }
  if (rateLimited()) {
    return c.json({ error: "rate_limited" }, 429);
  }

  const body = await c.req.parseBody({ all: true });
  const metaField = body.meta;
  if (typeof metaField !== "string" || Buffer.byteLength(metaField) > LIMITS.metaBytes) {
    return c.json({ error: "invalid_meta" }, 400);
  }

  let meta: ReturnType<typeof coachTurnMetaSchema.parse>;
  try {
    meta = coachTurnMetaSchema.parse(JSON.parse(metaField));
  } catch {
    return c.json({ error: "invalid_meta" }, 400);
  }

  const image = body.image;
  const audio = body.audio;
  if (!(image instanceof File) || !(audio instanceof File)) {
    return c.json({ error: "missing_media" }, 400);
  }
  if (!ALLOWED_IMAGE.has(image.type) || image.size > LIMITS.imageBytes) {
    return c.json({ error: "invalid_image" }, 400);
  }
  if (!ALLOWED_AUDIO.has(audio.type) && !audio.type.startsWith("audio/")) {
    return c.json({ error: "invalid_audio" }, 400);
  }
  if (audio.size > LIMITS.audioBytes) {
    return c.json({ error: "invalid_audio" }, 400);
  }

  const previous = activeTurns.get("local");
  previous?.abort();
  const controller = new AbortController();
  activeTurns.set("local", controller);

  try {
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const omniResult = await runOmniTurn(
      {
        requestId: meta.requestId,
        stage: meta.stage,
        measurementsJson: JSON.stringify(meta.measurements),
        captureNotes: meta.captureNotes ?? [],
        imageBase64: imageBuffer.toString("base64"),
        imageMime: image.type || "image/jpeg",
        audioBase64: audioBuffer.toString("base64"),
        audioFormat: audio.type || "audio/wav",
      },
      controller.signal,
    );
    const result = attachCoachVoice(omniResult);
    return c.json({
      requestId: meta.requestId,
      text: result.text,
      audioBase64: result.audioBase64,
      audioMime: result.audioMime,
      model: result.model,
      degraded: result.degraded,
      speechProvider: result.speechProvider,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "omni_failed";
    if (name === "OmniConfigError") {
      return c.json({ error: "omni_not_configured", requestId: meta.requestId }, 503);
    }
    if (name === "AbortError") {
      return c.json({ error: "cancelled", requestId: meta.requestId }, 409);
    }
    console.error("omni_turn_failed", meta.requestId, message);
    return c.json({ error: "omni_failed", requestId: meta.requestId }, 502);
  } finally {
    if (activeTurns.get("local") === controller) {
      activeTurns.delete("local");
    }
  }
});

const { hostname, port } = resolveServerAddress(process.env);
try {
  serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Align API listening on http://${hostname}:${port}`);
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
