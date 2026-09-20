import { describe, expect, it } from "vitest";
import { LANDMARK, type PoseFrame } from "@align/metrics";
import { previewStanceFromJpeg } from "./posePreview.js";

function standing(): PoseFrame {
  const landmarks: PoseFrame["landmarks"] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const points: Record<number, { x: number; y: number }> = {
    [LANDMARK.nose]: { x: 0.5, y: 0.1 },
    [LANDMARK.leftEar]: { x: 0.46, y: 0.11 },
    [LANDMARK.rightEar]: { x: 0.54, y: 0.11 },
    [LANDMARK.leftShoulder]: { x: 0.38, y: 0.24 },
    [LANDMARK.rightShoulder]: { x: 0.62, y: 0.24 },
    [LANDMARK.leftHip]: { x: 0.42, y: 0.52 },
    [LANDMARK.rightHip]: { x: 0.58, y: 0.52 },
    [LANDMARK.leftKnee]: { x: 0.43, y: 0.72 },
    [LANDMARK.rightKnee]: { x: 0.57, y: 0.72 },
    [LANDMARK.leftAnkle]: { x: 0.44, y: 0.92 },
    [LANDMARK.rightAnkle]: { x: 0.56, y: 0.92 },
  };
  for (const [index, value] of Object.entries(points)) {
    landmarks[Number(index)] = { ...value, visibility: 1 };
  }
  return { width: 1000, height: 1000, landmarks };
}

describe("previewStanceFromJpeg", () => {
  it("aligns a centered standing pose and treats the first frame as still", async () => {
    const result = await previewStanceFromJpeg(new Uint8Array([1, 2, 3]), "front", null, async () => standing());
    expect(result.aligned).toBe(true);
    expect(result.still).toBe(true);
    expect(result.pose).toBe(true);
  });

  it("does not align an empty pose", async () => {
    const result = await previewStanceFromJpeg(new Uint8Array([1, 2, 3]), "front", null, async () => null);
    expect(result.aligned).toBe(false);
    expect(result.pose).toBe(false);
  });
});
