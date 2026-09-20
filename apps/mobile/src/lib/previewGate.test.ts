import { describe, expect, it } from "vitest";
import { createPreviewGate } from "./previewGate";

describe("sample-based automatic capture", () => {
  it("advances on real checks even when each request takes two seconds", () => {
    const gate = createPreviewGate();
    gate.observe("front", 100, true, 2100);
    expect(gate.progress("front", 2100)).toBeCloseTo(1 / 3);
    gate.observe("front", 2300, true, 4300);
    expect(gate.progress("front", 4300)).toBeCloseTo(2 / 3);
    gate.observe("front", 4500, true, 6500);
    expect(gate.ready("front", 6500)).toBe(true);
  });
  it("never advances from elapsed time alone, duplicate samples, or stale responses", () => {
    const gate = createPreviewGate();
    gate.observe("front", 100, true, 200);
    gate.observe("front", 100, true, 300);
    expect(gate.progress("front", 500)).toBeCloseTo(1 / 3);
    gate.observe("front", 600, true, 7000);
    expect(gate.ready("front", 7000)).toBe(false);
    expect(gate.progress("front", 7000)).toBe(0);
  });
  it("resets on a failed check, view change, or a stalled request", () => {
    const gate = createPreviewGate();
    for (const time of [100, 700, 1300]) gate.observe("front", time, true, time + 100);
    expect(gate.ready("front", 1400)).toBe(true);
    expect(gate.ready("front", 5500)).toBe(false);
    expect(gate.ready("right", 1400)).toBe(false);
    gate.observe("front", 1500, false, 1600);
    expect(gate.progress("front", 1600)).toBe(0);
  });
});
