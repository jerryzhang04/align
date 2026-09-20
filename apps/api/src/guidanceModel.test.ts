import { describe, expect, it } from "vitest";
import { buildAnalysisRequest, parseModelDraft } from "./guidanceModel.js";

const input = {
  requestId: "r1",
  scanId: "s1",
  images: [
    { view: "front" as const, base64: "FRONT", mime: "image/jpeg" },
    { view: "right" as const, base64: "RIGHT", mime: "image/jpeg" },
    { view: "back" as const, base64: "BACK", mime: "image/jpeg" },
    { view: "left" as const, base64: "LEFT", mime: "image/jpeg" },
  ],
  audioBase64: "AUDIO",
  audioFormat: "audio/mp4",
  measurements: [],
  captureNotes: [],
  locale: "en-CA",
};

describe("guidance model adapter", () => {
  it("sends all ordered views, actual audio, and reviewed evidence", () => {
    const request = buildAnalysisRequest(input, {
      configured: true,
      mode: "omni",
      provider: "yibu",
      model: "qwen3.5-omni-plus",
      baseUrl: "https://yibuapi.com/v1",
      apiKey: "key",
      nativeAudioExpected: false,
    });
    const body = JSON.stringify(request);
    expect(body.indexOf("FRONT")).toBeLessThan(body.indexOf("RIGHT"));
    expect(body.indexOf("RIGHT")).toBeLessThan(body.indexOf("BACK"));
    expect(body.indexOf("BACK")).toBeLessThan(body.indexOf("LEFT"));
    expect(body).toContain("AUDIO");
    expect(body).toContain("data:audio/aac;base64,AUDIO");
    expect(buildAnalysisRequest(input, {
      configured: true,
      mode: "unconfigured",
      provider: null,
      model: "openrouter-test",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "key",
      nativeAudioExpected: false,
    }).messages[1]?.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "input_audio", input_audio: expect.objectContaining({ data: "AUDIO" }) }),
    ]));
    expect(body).toContain("ccohs-working-posture");
    expect(body).toContain('"type":"json_object"');
  });

  it("interpolates verified measurements into the user text", () => {
    const request = buildAnalysisRequest({
      ...input,
      measurements: [{
        id: "shoulder_line_tilt",
        value: 4.2,
        unit: "deg",
        view: "front",
        definitionVersion: "2026-09-19.1",
        sampleCount: 1,
        quality: "limited",
        limitations: ["test"],
      }],
    }, {
      configured: true,
      mode: "omni",
      provider: "yibu",
      model: "qwen3.5-omni-plus",
      baseUrl: "https://yibuapi.com/v1",
      apiKey: "key",
      nativeAudioExpected: false,
    });
    expect(JSON.stringify(request)).toContain("4.2");
    expect(JSON.stringify(request)).toContain("shoulder_line_tilt");
    expect(JSON.stringify(request)).not.toContain("${JSON.stringify");
  });

  it("parses JSON from a fenced provider response", () => {
    const draft = parseModelDraft(`\`\`\`json\n${JSON.stringify({
      summary: "General review.", observations: [], actions: [], limitations: [], safetySignalIds: [],
    })}\n\`\`\``);
    expect(draft.summary).toBe("General review.");
  });

  it("extracts the JSON object from provider reasoning text", () => {
    const payload = JSON.stringify({ summary: "General review.", observations: [], actions: [], limitations: [], safetySignalIds: [] });
    expect(parseModelDraft(`<think>private reasoning</think>\n${payload}`).summary).toBe("General review.");
  });
});
