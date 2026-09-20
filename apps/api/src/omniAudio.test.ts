import { describe, expect, it } from "vitest";
import { playableOmniAudio } from "./omniAudio.js";

describe("OMNI native audio", () => {
  it("wraps streamed 24 kHz mono PCM in a playable WAV container", () => {
    const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
    const wav = Buffer.from(playableOmniAudio(pcm.toString("base64")), "base64");
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
    expect(wav.subarray(44)).toEqual(pcm);
  });
  it("preserves providers that already return a WAV file", () => {
    const audio = playableOmniAudio(Buffer.alloc(20).toString("base64"));
    expect(playableOmniAudio(audio)).toBe(audio);
  });
});
