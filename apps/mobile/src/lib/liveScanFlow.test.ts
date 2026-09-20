import { describe, expect, it } from "vitest";
import { LIVE_SCAN_DURATION_MS, liveScanPhase, advanceLiveScan } from "./liveScanFlow";

describe("live scan phases", () => {
  it("guides one continuous rotation through four temporal phases", () => {
    expect(liveScanPhase(0)).toMatchObject({ view: "front", complete: false });
    expect(liveScanPhase(3_000)).toMatchObject({ view: "right", complete: false });
    expect(liveScanPhase(6_000)).toMatchObject({ view: "back", complete: false });
    expect(liveScanPhase(9_000)).toMatchObject({ view: "left", complete: false });
  });

  it("marks the scan complete after twelve seconds", () => {
    expect(LIVE_SCAN_DURATION_MS).toBe(12_000);
    expect(liveScanPhase(11_999).complete).toBe(false);
    expect(liveScanPhase(12_000)).toMatchObject({ view: "left", complete: true });
  });

  it("clamps negative elapsed time to the first phase", () => {
    expect(liveScanPhase(-100).view).toBe("front");
  });
});

describe("capture-driven progress", () => {
  it("holds a failed front capture instead of skipping to later views", () => {
    expect(advanceLiveScan(2_900, 5_000, new Set())).toBe(2_999);
  });
  it("never skips an entire view after a slow camera operation", () => {
    expect(advanceLiveScan(2_900, 5_000, new Set(["front"]))).toBe(3_000);
  });
  it("only completes once the last view has been captured", () => {
    expect(advanceLiveScan(11_900, 150, new Set(["front", "right", "back"]))).toBe(11_999);
    expect(advanceLiveScan(11_900, 150, new Set(["front", "right", "back", "left"]))).toBe(12_000);
  });
});
