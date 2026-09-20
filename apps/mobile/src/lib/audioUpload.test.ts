import { describe, expect, it } from "vitest";
import { recordingUpload } from "./audioUpload";

describe("recordingUpload", () => {
  it("sends WAV recordings as audio/wav for OMNI", () => {
    expect(recordingUpload("file:///cache/question.wav")).toEqual({ name: "question.wav", type: "audio/wav" });
  });

  it("keeps m4a labelled as mp4 for the multipart field", () => {
    expect(recordingUpload("file:///cache/question.m4a")).toEqual({ name: "question.m4a", type: "audio/mp4" });
  });
});
