import { describe, expect, it } from "vitest";
import { internalAngleDeg, median, segmentInclinationDeg, toPixel, verticalLeanDeg } from "./geometry.js";
import { nextHoldPhase } from "./hold.js";
import { imageKeypointsToPoseFrame } from "./keypoints.js";
import { LANDMARK, type PoseFrame } from "./landmarks.js";
import { aggregateMeasurements, measureFrame } from "./measure.js";

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

describe("imageKeypointsToPoseFrame", () => {
  it("maps named MoveNet shoulders into MediaPipe indices", () => {
    const frame = imageKeypointsToPoseFrame(
      [
        { name: "left_shoulder", x: 40, y: 80, score: 0.9 },
        { name: "right_shoulder", x: 160, y: 90, score: 0.9 },
        { name: "left_hip", x: 60, y: 180, score: 0.8 },
        { name: "right_hip", x: 140, y: 180, score: 0.8 },
        { name: "nose", x: 100, y: 40, score: 0.7 },
      ],
      200,
      200,
    );
    expect(frame).not.toBeNull();
    expect(frame!.landmarks[LANDMARK.leftShoulder]).toMatchObject({ x: 0.2, y: 0.4, visibility: 0.9 });
    expect(measureFrame(frame!, "front").shoulder_line_tilt).toBeGreaterThan(0);
  });

  it("rejects a skeleton with almost no confident joints", () => {
    expect(imageKeypointsToPoseFrame([{ name: "nose", x: 10, y: 10, score: 0.1 }], 100, 100)).toBeNull();
  });

  it("maps unnamed COCO-17 keypoints by index", () => {
    const keypoints = [
      { x: 100, y: 20, score: 0.9 },
      { x: 90, y: 24, score: 0.8 },
      { x: 110, y: 24, score: 0.8 },
      { x: 80, y: 30, score: 0.8 },
      { x: 120, y: 30, score: 0.8 },
      { x: 70, y: 80, score: 0.9 },
      { x: 130, y: 82, score: 0.9 },
    ];
    const frame = imageKeypointsToPoseFrame(keypoints, 200, 200);
    expect(frame).not.toBeNull();
    expect(frame!.landmarks[LANDMARK.leftShoulder]).toMatchObject({ x: 0.35, y: 0.4 });
    expect(frame!.landmarks[LANDMARK.rightShoulder]).toMatchObject({ x: 0.65, y: 0.41 });
  });
});

describe("aggregateMeasurements still protocol", () => {
  it("can mark a single clear still as usable", () => {
    const frame = frameFrom({
      [LANDMARK.leftShoulder]: point(0.35, 0.32),
      [LANDMARK.rightShoulder]: point(0.65, 0.36),
      [LANDMARK.leftHip]: point(0.4, 0.58),
      [LANDMARK.rightHip]: point(0.6, 0.58),
    });
    const [shoulder] = aggregateMeasurements([frame], "front", {
      minSamplesForUsable: 1,
      extraLimitations: ["Single-frame projection."],
    });
    expect(shoulder?.id).toBe("shoulder_line_tilt");
    expect(shoulder?.quality).toBe("usable");
    expect(shoulder?.limitations).toContain("Single-frame projection.");
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
      now: 1900,
      viewStartedAt: 0,
      qualityOk: true,
      motion: 0,
      accepted: 17,
      collectStartedAt: null,
      settleStartedAt: 1000,
    });
    expect(collecting.phase).toBe("collecting");
    const done = nextHoldPhase({
      now: 4800,
      viewStartedAt: 0,
      qualityOk: true,
      motion: 0,
      accepted: 17,
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
