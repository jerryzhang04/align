import { describe, expect, it } from "vitest";
import { localWellnessReport } from "./localGuidance";

describe("localWellnessReport", () => {
  it("quotes supplied measurements as a personalized practice score", () => {
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
    expect(report.summary).toMatch(/\/100/);
    expect(report.summary).not.toMatch(/diagnos|scoliosis|not medical advice/i);
    expect(report.practiceScores?.overall).toBeGreaterThan(0);
    expect(report.speechProvider).toBe("none");
  });

  it("still returns everyday-practice actions when no angles were measured", () => {
    const report = localWellnessReport({ requestId: "scan-2", measurements: [] });
    expect(report.observations).toEqual([]);
    expect(report.actions.length).toBeGreaterThan(0);
    expect(report.practiceScores).toBeNull();
    expect(report.summary).toContain("everyday good practice");
  });
});
