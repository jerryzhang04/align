import { describe, expect, it } from "vitest";
import { localCoachText, localWellnessCore } from "./localGuidance.js";

describe("localWellnessCore", () => {
  it("quotes pose-measured degrees and resolves reviewed sources", () => {
    const core = localWellnessCore([{
      id: "shoulder_line_tilt",
      value: 4.2,
      unit: "deg",
      view: "front",
      definitionVersion: "2026-09-19.1",
      sampleCount: 1,
      quality: "limited",
      limitations: ["Projected shoulder line."],
    }]);
    expect(core.observations[0]?.text).toContain("4.2 degrees");
    expect(core.sources.map((source) => source.id)).toEqual([
      "ccohs-working-posture",
      "who-physical-activity-2020",
      "swain-posture-lbp-2020",
    ]);
    expect(core.safety.level).toBe("wellness");
  });
});

describe("localCoachText", () => {
  it("does not invent numbers when the measurement list is empty", () => {
    expect(localCoachText([])).not.toMatch(/\d/);
    expect(localCoachText([])).toContain("not medical advice");
  });
});
