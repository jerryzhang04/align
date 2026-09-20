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
    expect(core.sources.map((source) => source.id)).toEqual(["ccohs-working-posture"]);
    expect(core.safety.level).toBe("wellness");
    expect(core.summary).toMatch(/\/100/);
    expect(core.safety.message).toMatch(/everyday alignment practice/i);
  });
});

describe("localCoachText", () => {
  it("does not invent numbers when the measurement list is empty", () => {
    expect(localCoachText([])).not.toMatch(/\d/);
    expect(localCoachText([])).toContain("Good practice");
    expect(localCoachText([])).not.toContain("not medical advice");
  });
});
