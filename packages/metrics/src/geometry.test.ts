import { describe, expect, it } from "vitest";
import { internalAngleDeg, median, segmentInclinationDeg, toPixel, verticalLeanDeg } from "./geometry.js";
import { nextHoldPhase } from "./hold.js";
import { LANDMARK, type PoseFrame } from "./landmarks.js";
import { measureFrame } from "./measure.js";

function point(x: number, y: number) {
  return { x, y, visibility: 1 };
}

function frameFrom(points: Record<number, { x: number; y: number }>): PoseFrame {
  const landmarks: PoseFrame["landmarks"] = Array.from({ length: 33 }, (_, index) => points[index] ?? { x: 0.5, y: 0.5, visibility: 0.2 });
  for (const [index, value] of Object.entries(points)) {
    landmarks[Number(index)] = { ...value, visibility: 1 };
  }
  return { width: 1000, height: 1000, landmarks };
}

describe("geometry", () => {
  it("converts normalized landmarks into pixels", () => {
    expect(toPixel(0.25, 0.5, 200, 100)).toEqual({ x: 50, y: 50 });
  });

  it("measures a right angle at B", () => {
    expect(internalAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 })).toBeCloseTo(90, 4);
  });

  it("rejects near-zero vectors", () => {
    expect(internalAngleDeg({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 8, y: 1 })).toBeNull();
  });

  it("reports a level shoulder line as about 0", () => {
    expect(segmentInclinationDeg({ x: 10, y: 40 }, { x: 90, y: 40 })).toBeCloseTo(0, 4);
  });

  it("reports a right-low shoulder line as positive in image space", () => {
    const tilt = segmentInclinationDeg({ x: 10, y: 40 }, { x: 90, y: 50 });
    expect(tilt).not.toBeNull();
    expect(tilt!).toBeGreaterThan(0);
  });

  it("keeps a vertical trunk near 0 lean", () => {
    expect(verticalLeanDeg({ x: 50, y: 10 }, { x: 50, y: 90 })).toBeCloseTo(0, 4);
  });

  it("computes a median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1])).toBe(2.5);
  });
});

describe("measureFrame", () => {
  it("computes shoulder tilt on a front view", () => {
    const frame = frameFrom({
      [LANDMARK.leftShoulder]: point(0.35, 0.32),
      [LANDMARK.rightShoulder]: point(0.65, 0.36),
      [LANDMARK.leftHip]: point(0.4, 0.58),
      [LANDMARK.rightHip]: point(0.6, 0.58),
      [LANDMARK.leftEar]: point(0.44, 0.18),
      [LANDMARK.rightEar]: point(0.56, 0.18),
    });
    const measured = measureFrame(frame, "front");
    expect(measured.shoulder_line_tilt).toBeGreaterThan(0);
    expect(measured.head_line_tilt).toBeCloseTo(0, 0);
  });
});

describe("hold machine", () => {
  it("accepts after settling, collecting, and enough samples", () => {
    const first = nextHoldPhase({
      now: 1000,
      viewStartedAt: 0,
      qualityOk: true,
      motion: 0,
      accepted: 0,
      collectStartedAt: null,
      settleStartedAt: null,
    });
    expect(first.phase).toBe("settling");
    const collecting = nextHoldPhase({
      now: 1700,
      viewStartedAt: 0,
      qualityOk: true,
      motion: 0,
      accepted: 14,
      collectStartedAt: null,
      settleStartedAt: 1000,
    });
    expect(collecting.phase).toBe("collecting");
    const done = nextHoldPhase({
      now: 3800,
      viewStartedAt: 0,
      qualityOk: true,
      motion: 0,
      accepted: 14,
      collectStartedAt: collecting.collectStartedAt,
      settleStartedAt: collecting.settleStartedAt,
    });
    expect(done.phase).toBe("accepted");
    expect(done.accept).toBe(true);
  });

  it("returns to coaching when the pose is unstable", () => {
    const next = nextHoldPhase({
      now: 5000,
      viewStartedAt: 0,
      qualityOk: false,
      motion: 0.2,
      accepted: 4,
      collectStartedAt: 2000,
      settleStartedAt: 1000,
    });
    expect(next.phase).toBe("coaching");
  });
});
