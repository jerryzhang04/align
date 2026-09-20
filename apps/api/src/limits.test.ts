import { describe, expect, it } from "vitest";
import { acceptableAudio, LIMITS } from "./limits.js";

describe("acceptableAudio", () => {
  it("accepts expo-audio m4a types and a missing type from iOS uploads", () => {
    expect(acceptableAudio({ type: "audio/m4a", size: 12_000 })).toBe(true);
    expect(acceptableAudio({ type: "audio/x-m4a", size: 12_000 })).toBe(true);
    expect(acceptableAudio({ type: "", size: 12_000 })).toBe(true);
    expect(acceptableAudio({ type: "application/octet-stream", size: 12_000 })).toBe(true);
  });

  it("rejects oversized recordings", () => {
    expect(acceptableAudio({ type: "audio/mp4", size: LIMITS.audioBytes + 1 })).toBe(false);
  });
});
