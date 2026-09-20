import { describe, expect, it } from "vitest";
import { localWellnessReport } from "./localGuidance";

describe("localWellnessReport", () => {
  it("quotes only supplied degree measurements and stays inside screening language", () => {
    const report = localWellnessReport({
      requestId: "scan-1",
      measurements: [{
        id: "shoulder_line_tilt",
        value: 4.2,
        unit: "deg",
        view: "front",
        definitionVersion: "2026-09-19.1",
        sampleCount: 1,
        quality: "limited",
        limitations: ["Projected shoulder line."],
      }],
    });

    expect(report.observations[0]?.text).toContain("4.2 degrees");
    expect(report.summary).not.toMatch(/diagnos|scoliosis/i);
    expect(report.sources.map((source) => source.id)).toEqual([
      "ccohs-working-posture",
      "who-physical-activity-2020",
      "swain-posture-lbp-2020",
    ]);
    expect(report.speechProvider).toBe("none");
  });

  it("still returns evidence-backed actions when no angles were measured", () => {
    const report = localWellnessReport({ requestId: "scan-2", measurements: [] });
    expect(report.observations).toEqual([]);
    expect(report.actions.length).toBeGreaterThan(0);
    expect(report.summary).toContain("No verified posture angles");
  });
});
