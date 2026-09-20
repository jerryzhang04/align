import { describe, expect, it } from "vitest";
import type { Measurement } from "@align/contracts";
import { practiceProfile } from "./practiceScore.js";

function measurement(partial: Partial<Measurement> & Pick<Measurement, "id" | "value" | "unit" | "view">): Measurement {
  return {
    definitionVersion: "2026-09-19.1",
    sampleCount: 1,
    quality: "usable",
    limitations: [],
    ...partial,
  };
}

describe("practiceProfile", () => {
  it("scores a near-level shoulder line high and a large tilt lower", () => {
    const high = practiceProfile([measurement({ id: "shoulder_line_tilt", value: 1.2, unit: "deg", view: "front" })]);
    const low = practiceProfile([measurement({ id: "shoulder_line_tilt", value: 11, unit: "deg", view: "front" })]);
    expect(high.overall).toBeGreaterThan(85);
    expect(low.overall).toBeLessThan(high.overall);
    expect(low.areas[0]?.improve).toMatch(/bag/i);
    expect(low.areas[0]?.whyCommon).toMatch(/shoulder/i);
  });

  it("does not invent a score when nothing was measured", () => {
    const empty = practiceProfile([]);
    expect(empty.areas).toEqual([]);
    expect(empty.overall).toBe(0);
    expect(empty.limitations.join(" ")).toMatch(/No camera-alignment score/);
  });
});
