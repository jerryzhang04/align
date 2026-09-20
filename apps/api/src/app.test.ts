import { describe, expect, it } from "vitest";
import { VIEWS } from "@align/contracts";
import { createApp } from "./app.js";

const provider = {
  configured: true,
  mode: "omni" as const,
  provider: "yibu" as const,
  model: "qwen3.5-omni-plus",
  baseUrl: "https://yibuapi.com/v1",
  apiKey: "key",
  nativeAudioExpected: false,
};

function validForm() {
  const form = new FormData();
  form.set("meta", JSON.stringify({ requestId: "r1", scanId: "s1", views: ["front", "right", "back", "left"], measurements: [], locale: "en-CA" }));
  for (const view of ["front", "right", "back", "left"]) form.set(view, new Blob([view], { type: "image/jpeg" }), `${view}.jpg`);
  form.set("audio", new Blob(["audio"], { type: "audio/mp4" }), "question.m4a");
  return form;
}

function liveFrameForm(requestId: string, capturedAtMs: number, view = "front") {
  const form = new FormData();
  form.set("meta", JSON.stringify({ requestId, capturedAtMs, view }));
  form.set("image", new Blob([`jpeg-${capturedAtMs}`], { type: "image/jpeg" }), `${requestId}.jpg`);
  return form;
}

function liveFinalizeForm() {
  const form = new FormData();
  form.set("meta", JSON.stringify({ requestId: "live-final", measurements: [], locale: "en-CA" }));
  form.set("audio", new Blob(["audio"], { type: "audio/mp4" }), "question.m4a");
  return form;
}

describe("guidance API", () => {
  it("reports OMNI provider identity truthfully", async () => {
    const response = await createApp({ provider: () => provider }).request("/v1/health");
    expect(await response.json()).toMatchObject({ omniConfigured: true, guidanceConfigured: true, providerMode: "omni" });
  });

  it("returns a validated sourced report for four images and audio", async () => {
    const app = createApp({
      provider: () => provider,
      analyze: async (input) => ({
        summary: `Reviewed ${input.images.length} views.`,
        observations: [],
        actions: [{ id: "move", title: "Change positions", instruction: "Vary your position.", rationale: "There is no single posture for extended periods.", sourceIds: ["ccohs-working-posture"] }],
        limitations: [],
        safetySignalIds: [],
      }),
      speak: async () => ({}),
    });
    const response = await app.request("/v1/guidance/report", { method: "POST", body: validForm() });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toBe("Reviewed 4 views.");
    expect(body.sources[0].id).toBe("ccohs-working-posture");
    expect(body.providerMode).toBe("omni");
  });

  it("rejects a missing view before calling the provider", async () => {
    const form = validForm();
    form.delete("left");
    const response = await createApp({ provider: () => provider }).request("/v1/guidance/report", { method: "POST", body: form });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "missing_media" });
  });

  it("buffers sampled live frames and finalizes them through the guidance pipeline", async () => {
    let analyzedFrameCount = 0;
    const app = createApp({
      provider: () => provider,
      analyze: async (input) => {
        analyzedFrameCount = input.images.length;
        return {
          summary: `Reviewed ${input.images.length} live samples.`,
          observations: [],
          actions: [{ id: "move", title: "Change positions", instruction: "Vary your position.", rationale: "There is no single posture for extended periods.", sourceIds: ["ccohs-working-posture"] }],
          limitations: [],
          safetySignalIds: [],
        };
      },
      speak: async () => ({}),
    });

    for (const [index, capturedAtMs] of [0, 1_000, 2_000, 3_000].entries()) {
      const frame = await app.request("/v1/live/sessions/live-scan/frames", {
        method: "POST",
        body: liveFrameForm(`frame-${index}`, capturedAtMs, VIEWS[index]),
      });
      expect(frame.status).toBe(202);
    }

    const response = await app.request("/v1/live/sessions/live-scan/finalize", {
      method: "POST",
      body: liveFinalizeForm(),
    });

    expect(response.status).toBe(200);
    expect(analyzedFrameCount).toBe(4);
    expect(await response.json()).toMatchObject({ summary: "Reviewed 4 live samples.", speechProvider: "none" });
  });

  it("rejects finalizing a live session before any frames arrive", async () => {
    const app = createApp({ provider: () => provider });
    const response = await app.request("/v1/live/sessions/empty/finalize", {
      method: "POST",
      body: liveFinalizeForm(),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "missing_live_frames" });
  });

  it("clears buffered live frames when a scan is discarded", async () => {
    const app = createApp({ provider: () => provider });
    await app.request("/v1/live/sessions/discard-me/frames", {
      method: "POST",
      body: liveFrameForm("frame-1", 0),
    });

    const reset = await app.request("/v1/live/sessions/discard-me", { method: "DELETE" });
    expect(reset.status).toBe(204);

    const finalize = await app.request("/v1/live/sessions/discard-me/finalize", {
      method: "POST",
      body: liveFinalizeForm(),
    });
    expect(finalize.status).toBe(400);
    expect(await finalize.json()).toMatchObject({ error: "missing_live_frames" });

    const lateFrame = await app.request("/v1/live/sessions/discard-me/frames", {
      method: "POST",
      body: liveFrameForm("late-frame", 1_000),
    });
    expect(lateFrame.status).toBe(409);
    expect(await lateFrame.json()).toMatchObject({ error: "live_session_closed" });
  });
});


it("keeps valid guidance when the optional speech service fails", async () => {
  const app = createApp({
    provider: () => ({ ...provider, nativeAudioExpected: true }),
    analyze: async () => ({ summary: "Change positions regularly.", observations: [], actions: [], limitations: [], safetySignalIds: [] }),
    speak: async () => { throw new Error("speech unavailable"); },
  });
  const response = await app.request("/v1/guidance/report", { method: "POST", body: validForm() });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ summary: "Change positions regularly.", speechProvider: "none", degraded: true });
});


it("releases buffered live photos after a report made from retained local images", async () => {
  const app = createApp({
    provider: () => provider,
    analyze: async () => ({ summary: "Review complete.", observations: [], actions: [], limitations: [], safetySignalIds: [] }),
    speak: async () => ({}),
  });
  for (const [index, view] of VIEWS.entries()) {
    await app.request("/v1/live/sessions/s1/frames", { method: "POST", body: liveFrameForm(`cleanup-${index}`, index * 1000, view) });
  }
  const report = await app.request("/v1/guidance/report", { method: "POST", body: validForm() });
  expect(report.status).toBe(200);
  const leftover = await app.request("/v1/live/sessions/s1/finalize", { method: "POST", body: liveFinalizeForm() });
  expect(leftover.status).toBe(400);
  expect(await leftover.json()).toMatchObject({ error: "missing_live_frames" });
});
