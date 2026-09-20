import { describe, expect, it } from "vitest";
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
});
