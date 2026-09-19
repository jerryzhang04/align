import { describe, expect, it } from "vitest";
import { attachCoachVoice } from "./coachVoice.js";

describe("attachCoachVoice", () => {
  it("reports OMNI as the speech provider when OMNI returned audio", () => {
    const result = attachCoachVoice({
      text: "Turn right.",
      model: "omni-test",
      audioBase64: "omni-audio",
      audioMime: "audio/wav",
    });

    expect(result.audioBase64).toBe("omni-audio");
    expect(result.audioMime).toBe("audio/wav");
    expect(result.speechProvider).toBe("omni");
  });

  it("falls back to captions when OMNI returned text only", () => {
    const result = attachCoachVoice({ text: "Move back.", model: "omni-test" });

    expect(result.audioBase64).toBeUndefined();
    expect(result.speechProvider).toBe("none");
  });

  it("preserves the OMNI text and degraded flag unchanged", () => {
    const result = attachCoachVoice({ text: "Hold still.", model: "omni-test", degraded: true });

    expect(result.text).toBe("Hold still.");
    expect(result.degraded).toBe(true);
    expect(result.speechProvider).toBe("none");
  });
});
