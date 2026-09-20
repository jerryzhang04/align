import { describe, expect, it } from "vitest";
import { bodyGuideVariant, holdFill, holdReadyToCapture, scanActionLabel, scanInstruction, scanPhaseLabel, VIEW_HOLD_MS } from "./bodyGuide";

describe("holdFill", () => {
  it("stays empty until the hold starts", () => {
    expect(holdFill(0)).toBe(0);
    expect(holdFill(-20)).toBe(0);
  });

  it("fills linearly to one when the hold completes", () => {
    expect(holdFill(VIEW_HOLD_MS / 2)).toBe(0.5);
    expect(holdFill(VIEW_HOLD_MS)).toBe(1);
    expect(holdFill(VIEW_HOLD_MS + 400)).toBe(1);
  });
});

describe("holdReadyToCapture", () => {
  it("captures once the outline is full and this view is still open", () => {
    expect(holdReadyToCapture(VIEW_HOLD_MS, false)).toBe(true);
    expect(holdReadyToCapture(VIEW_HOLD_MS - 1, false)).toBe(false);
    expect(holdReadyToCapture(VIEW_HOLD_MS, true)).toBe(false);
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
});

describe("scanActionLabel", () => {
  it("shows fill percent until the photo locks, then names the save", () => {
    expect(scanActionLabel({ cameraReady: true, liveStarted: true, busy: false, locked: false, fill: 0.4 })).toBe("40% filled");
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
