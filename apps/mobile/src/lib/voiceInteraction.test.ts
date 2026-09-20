import { describe, expect, it } from "vitest";
import { voiceButtonAction } from "./voiceInteraction";

describe("voiceButtonAction", () => {
  it("starts an idle voice turn", () => {
    expect(voiceButtonAction({ preparing: false, recording: false, busy: false })).toBe("start");
  });

  it("finishes an active recording on the next tap", () => {
    expect(voiceButtonAction({ preparing: false, recording: true, busy: false })).toBe("finish");
  });

  it("ignores taps while microphone setup or an OMNI request is in flight", () => {
    expect(voiceButtonAction({ preparing: true, recording: false, busy: false })).toBe("none");
    expect(voiceButtonAction({ preparing: false, recording: false, busy: true })).toBe("none");
  });
});
