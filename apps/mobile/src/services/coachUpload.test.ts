import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertFormDataAsync } from "../../node_modules/expo/src/winter/fetch/convertFormData";

const { requests } = vi.hoisted(() => ({ requests: [] as RequestInit[] }));
vi.mock("./runtimeCoachApi", () => ({ runtimeCoachApi: () => ({ baseUrl: "http://test", token: "" }) }));
vi.mock("expo-file-system", () => ({ File: class {
  name: string;
  type: string;
  constructor(public uri: string) {
    this.name = uri.split("/").pop()!;
    this.type = uri.endsWith(".wav") ? "audio/wav" : "image/jpeg";
  }
  async bytes() { return new Uint8Array([1, 2, 3]); }
} }));
vi.mock("./request", () => ({ fetchWithTimeout: async (_url: string, init: RequestInit) => {
  requests.push(init);
  // Exercise the installed Expo encoder, where URI-only parts fail on iPhone.
  await convertFormDataAsync(init.body as FormData);
  return { ok: false, json: async () => ({ error: "reached_server" }) };
} }));
import { createLiveCoachClient } from "./liveCoach";
import { fetchWithTimeout } from "./request";
import { askCoach, previewStance, requestGuidance, requestPoseMeasurements } from "./coach";

beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal("FormData", class {
    parts: [string, unknown][] = [];
    append(name: string, value: unknown) { this.parts.push([name, value]); }
    *entries() { yield* this.parts; }
  });
});
const live = createLiveCoachClient({ baseUrl: "http://test", token: "", fetchImpl: fetchWithTimeout });
const base = { requestId: "request", scanId: "scan" };
const captures = { front: "file:///front.jpg", right: "file:///right.jpg", back: "file:///back.jpg", left: "file:///left.jpg" };
describe("iPhone upload compatibility", () => {
  it.each([
    ["live frame", () => live.uploadFrame({ ...base, view: "front", capturedAtMs: 10, imageUri: captures.front })],
    ["live audio", () => live.finalize({ ...base, audioUri: "file:///question.wav" })],
    ["voice", () => askCoach({ ...base, stage: "front", imageUri: captures.front, audioUri: "file:///question.wav" })],
    ["preview", () => previewStance({ ...base, view: "front", imageUri: captures.front })],
    ["measurements", () => requestPoseMeasurements({ ...base, captures })],
    ["photo-only report", () => requestGuidance({ ...base, captures })],
    ["report", () => requestGuidance({ ...base, captures, audioUri: "file:///question.wav" })],
  ] as const)("encodes %s files with the installed Expo multipart implementation", async (_label, run) => {
    await expect(run()).rejects.toThrow("reached_server");
    const encoded = await convertFormDataAsync(requests[0]!.body as FormData);
    const text = new TextDecoder().decode(encoded.body);
    expect(text).toContain('filename="');
    expect(text).toContain(_label === "live audio" ? "audio/wav" : "image/jpeg");
  });
});
