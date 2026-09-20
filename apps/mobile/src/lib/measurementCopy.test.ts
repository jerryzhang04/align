import { describe, expect, it } from "vitest";
import { formatMeasurement, measurementLabel, mergeMeasurements } from "./measurementCopy";

describe("measurementCopy", () => {
  it("formats degrees and humanizes ids", () => {
    expect(measurementLabel("shoulder_line_tilt")).toBe("Shoulder line tilt");
    expect(formatMeasurement({
      id: "shoulder_line_tilt",
      value: 4.21,
      unit: "deg",
      view: "front",
      definitionVersion: "2026-09-19.1",
      sampleCount: 1,
      quality: "limited",
      limitations: [],
    })).toBe("4.2°");
  });

  it("replaces the same view and metric when merging", () => {
    const current = [{
      id: "shoulder_line_tilt",
      value: 1,
      unit: "deg" as const,
      view: "front" as const,
      definitionVersion: "2026-09-19.1",
      sampleCount: 1,
      quality: "limited" as const,
      limitations: [],
    }];
    const incoming = [{ ...current[0]!, value: 4.2, view: "front" as const }];
    expect(mergeMeasurements(current, incoming)[0]?.value).toBe(4.2);
    expect(mergeMeasurements(current, []).length).toBe(1);
  });
});
