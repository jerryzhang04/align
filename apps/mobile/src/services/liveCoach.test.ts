import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { hostUri: null }, linkingUri: "" },
}));

import { createLiveCoachClient } from "./liveCoach";

const report = {
  requestId: "final-1",
  summary: "Summary",
  observations: [],
  actions: [],
  limitations: [],
  safety: { level: "wellness", message: "", signalIds: [] },
  sources: [],
  speechProvider: "none",
  providerMode: "omni",
  model: "qwen3.5-omni-plus",
  latencyMs: 12,
};

describe("live coach client", () => {
  it("uploads a timestamped sampled frame with bearer authorization", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ requestId: "frame-1", accepted: true, replaced: false, frameCount: 1 }), { status: 202 });
    });
    const client = createLiveCoachClient({ baseUrl: "http://example.test/", token: "phone-token", fetchImpl });
    const signal = new AbortController().signal;

    await client.uploadFrame({ scanId: "scan/id", requestId: "frame-1", capturedAtMs: 750, view: "front", imageUri: "file:///frame.jpg", signal });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = calls[0]!;
    expect(url).toBe("http://example.test/v1/live/sessions/scan%2Fid/frames");
    expect(init).toMatchObject({ method: "POST", signal, headers: { Authorization: "Bearer phone-token" } });
    const form = init!.body as FormData;
    expect(JSON.parse(String(form.get("meta")))).toEqual({ requestId: "frame-1", capturedAtMs: 750, view: "front" });
  });

  it("finalizes a live session and validates the guidance report", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(JSON.stringify(report), { status: 200 });
    });
    const client = createLiveCoachClient({ baseUrl: "http://example.test", token: "", fetchImpl });

    const result = await client.finalize({ scanId: "scan-1", requestId: "final-1", audioUri: "file:///goal.m4a" });

    expect(result.summary).toBe("Summary");
    const [, init] = calls[0]!;
    expect(init!.headers).toBeUndefined();
  });

  it("surfaces stable server error codes", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "missing_live_frames" }), { status: 400 }));
    const client = createLiveCoachClient({ baseUrl: "http://example.test", token: "", fetchImpl });

    await expect(client.finalize({ scanId: "scan-1", requestId: "final-1", audioUri: "file:///goal.m4a" })).rejects.toThrow("missing_live_frames");
  });

  it("discards a buffered session without sending media", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return new Response(null, { status: 204 });
    });
    const client = createLiveCoachClient({ baseUrl: "http://example.test", token: "phone-token", fetchImpl });

    await client.reset("scan/id");

    expect(calls[0]).toEqual([
      "http://example.test/v1/live/sessions/scan%2Fid",
      { method: "DELETE", headers: { Authorization: "Bearer phone-token" } },
    ]);
  });
});
