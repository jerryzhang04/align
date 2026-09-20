import { describe, expect, it } from "vitest";
import { tickHoldFill } from "./hold.js";
import { LANDMARK, type PoseFrame } from "./landmarks.js";
import { fitBodyGuide } from "./quality.js";

function point(x: number, y: number) {
  return { x, y, visibility: 1 };
}

function frameFrom(points: Record<number, { x: number; y: number }>): PoseFrame {
  const landmarks: PoseFrame["landmarks"] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  for (const [index, value] of Object.entries(points)) {
    landmarks[Number(index)] = { ...value, visibility: 1 };
  }
  return { width: 1000, height: 1000, landmarks };
}

function standingFront(shiftX = 0, scaleY = 1): PoseFrame {
  const x = (value: number) => value + shiftX;
  const y = (value: number) => 0.08 + (value - 0.08) * scaleY;
  return frameFrom({
    [LANDMARK.nose]: point(x(0.5), y(0.1)),
    [LANDMARK.leftEar]: point(x(0.46), y(0.11)),
    [LANDMARK.rightEar]: point(x(0.54), y(0.11)),
    [LANDMARK.leftShoulder]: point(x(0.38), y(0.24)),
    [LANDMARK.rightShoulder]: point(x(0.62), y(0.24)),
    [LANDMARK.leftHip]: point(x(0.42), y(0.52)),
    [LANDMARK.rightHip]: point(x(0.58), y(0.52)),
    [LANDMARK.leftKnee]: point(x(0.43), y(0.72)),
    [LANDMARK.rightKnee]: point(x(0.57), y(0.72)),
    [LANDMARK.leftAnkle]: point(x(0.44), y(0.92)),
    [LANDMARK.rightAnkle]: point(x(0.56), y(0.92)),
  });
}

describe("fitBodyGuide", () => {
  it("accepts a centered full-height standing pose", () => {
    expect(fitBodyGuide(standingFront(), "front").ok).toBe(true);
  });

  it("rejects a person who is too far from the camera", () => {
    const result = fitBodyGuide(standingFront(0, 0.35), "front");
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "too_far")).toBe(true);
  });

  it("rejects someone standing off to one side", () => {
    const result = fitBodyGuide(standingFront(0.28), "front");
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "off_center")).toBe(true);
  });
});

describe("tickHoldFill", () => {
  it("stays empty until the stance is valid", () => {
    expect(tickHoldFill(0, 500, false)).toBe(0);
  });

  it("fills only while aligned and drains when they leave", () => {
    const filling = tickHoldFill(0, 1400, true, 2800);
    expect(filling).toBeCloseTo(0.5, 5);
    expect(tickHoldFill(filling, 420, false, 2800, 420)).toBeCloseTo(0, 5);
  });
});
