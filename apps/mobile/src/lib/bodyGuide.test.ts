import { describe, expect, it } from "vitest";
import { bodyGuideVariant, holdFill, holdReadyToCapture, scanActionLabel, scanInstruction, scanPhaseLabel, tickHoldFill, VIEW_FILL_MS } from "./bodyGuide";

describe("tickHoldFill", () => {
  it("stays empty until the stance is valid", () => {
    expect(tickHoldFill(0, 800, false)).toBe(0);
    expect(holdFill(0)).toBe(0);
  });

  it("fills only while aligned and drains when they leave", () => {
    const half = tickHoldFill(0, VIEW_FILL_MS / 2, true);
    expect(half).toBeCloseTo(0.5, 5);
    expect(tickHoldFill(half, 420, false, VIEW_FILL_MS, 420)).toBeCloseTo(0, 5);
  });
});

describe("holdReadyToCapture", () => {
  it("captures only when the outline is full and the stance is still valid", () => {
    expect(holdReadyToCapture(1, false, true)).toBe(true);
    expect(holdReadyToCapture(1, false, false)).toBe(false);
    expect(holdReadyToCapture(0.99, false, true)).toBe(false);
    expect(holdReadyToCapture(1, true, true)).toBe(false);
  });
});

describe("bodyGuideVariant", () => {
  it("uses a front silhouette for front and back, and a side silhouette for the turns", () => {
    expect(bodyGuideVariant("front")).toBe("front");
    expect(bodyGuideVariant("back")).toBe("front");
    expect(bodyGuideVariant("right")).toBe("side");
    expect(bodyGuideVariant("left")).toBe("side");
  });
});

describe("scanInstruction", () => {
  it("tells people to match head and shoulders before the clock starts", () => {
    expect(scanInstruction("front", false)).toContain("head and shoulders");
  });

  it("names the next turn once a view is active", () => {
    expect(scanInstruction("right", true)).toContain("right side");
    expect(scanInstruction("left", true)).toContain("left side");
  });

  it("prefers a live stance hint from pose preview", () => {
    expect(scanInstruction("front", true, "Step closer until your head and feet fill the outline.")).toContain("Step closer");
  });
});

describe("scanActionLabel", () => {
  it("shows fill percent until the photo locks, then names the save", () => {
    expect(scanActionLabel({ cameraReady: true, liveStarted: true, busy: false, locked: false, fill: 0.4, aligned: true })).toBe("40% filled");
    expect(scanActionLabel({ cameraReady: true, liveStarted: true, busy: false, locked: false, fill: 0, aligned: false })).toBe("Match the outline");
    expect(scanActionLabel({ cameraReady: true, liveStarted: true, busy: false, locked: true, fill: 1 })).toBe("Photo saved");
  });
});

describe("scanPhaseLabel", () => {
  it("names the current outline instead of a continuous scan", () => {
    expect(scanPhaseLabel("front", false, false)).toBe("MATCH THE OUTLINE");
    expect(scanPhaseLabel("right", true, false)).toBe("RIGHT SIDE");
    expect(scanPhaseLabel("left", true, true)).toBe("FINAL STEP");
  });
});
