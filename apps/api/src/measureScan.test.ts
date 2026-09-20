import { describe, expect, it } from "vitest";
import { LANDMARK } from "@align/metrics";
import { measurePoseImages } from "./measureScan.js";

describe("measurePoseImages", () => {
  it("aggregates injected pose frames into projected measurements", async () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
    landmarks[LANDMARK.leftShoulder] = { x: 0.35, y: 0.32, visibility: 0.95 };
    landmarks[LANDMARK.rightShoulder] = { x: 0.65, y: 0.38, visibility: 0.95 };
    landmarks[LANDMARK.leftHip] = { x: 0.4, y: 0.6, visibility: 0.9 };
    landmarks[LANDMARK.rightHip] = { x: 0.6, y: 0.6, visibility: 0.9 };
    landmarks[LANDMARK.leftEar] = { x: 0.42, y: 0.18, visibility: 0.8 };
    landmarks[LANDMARK.rightEar] = { x: 0.58, y: 0.18, visibility: 0.8 };
    landmarks[LANDMARK.nose] = { x: 0.5, y: 0.16, visibility: 0.8 };
    landmarks[LANDMARK.leftAnkle] = { x: 0.42, y: 0.9, visibility: 0.8 };
    landmarks[LANDMARK.rightAnkle] = { x: 0.58, y: 0.9, visibility: 0.8 };

    const result = await measurePoseImages(
      [{ view: "front", bytes: new Uint8Array([1, 2, 3]) }],
      async () => ({ width: 200, height: 400, landmarks }),
    );

    expect(result.source).toBe("movenet-lightning");
    expect(result.viewsWithPose).toEqual(["front"]);
    expect(result.measurements.some((item) => item.id === "shoulder_line_tilt" && item.view === "front")).toBe(true);
  });

  it("returns no measurements when pose cannot be estimated", async () => {
    const result = await measurePoseImages(
      [{ view: "front", bytes: new Uint8Array([1]) }],
      async () => null,
    );
    expect(result).toEqual({ measurements: [], source: "none", viewsWithPose: [] });
  });
});
