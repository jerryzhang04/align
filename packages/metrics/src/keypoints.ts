import { LANDMARK, type LandmarkSample, type PoseFrame } from "./landmarks.js";

export type ImageKeypoint = {
  x: number;
  y: number;
  score?: number;
  name?: string;
};

/** MoveNet / COCO-17 names onto the MediaPipe Pose 33-index skeleton used by measureFrame. */
export const MOVENET_NAME_TO_INDEX: Record<string, number> = {
  nose: LANDMARK.nose,
  left_eye: 2,
  right_eye: 5,
  left_ear: LANDMARK.leftEar,
  right_ear: LANDMARK.rightEar,
  left_shoulder: LANDMARK.leftShoulder,
  right_shoulder: LANDMARK.rightShoulder,
  left_elbow: LANDMARK.leftElbow,
  right_elbow: LANDMARK.rightElbow,
  left_wrist: LANDMARK.leftWrist,
  right_wrist: LANDMARK.rightWrist,
  left_hip: LANDMARK.leftHip,
  right_hip: LANDMARK.rightHip,
  left_knee: LANDMARK.leftKnee,
  right_knee: LANDMARK.rightKnee,
  left_ankle: LANDMARK.leftAnkle,
  right_ankle: LANDMARK.rightAnkle,
};

const COCO17_ORDER = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

function emptyLandmarks(): LandmarkSample[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
}

function landmarkIndex(keypoint: ImageKeypoint, position: number): number | null {
  if (keypoint.name && keypoint.name in MOVENET_NAME_TO_INDEX) {
    return MOVENET_NAME_TO_INDEX[keypoint.name]!;
  }
  const cocoName = COCO17_ORDER[position];
  if (cocoName && cocoName in MOVENET_NAME_TO_INDEX) {
    return MOVENET_NAME_TO_INDEX[cocoName]!;
  }
  return null;
}

/**
 * Convert pixel-space pose keypoints into the normalized PoseFrame the metric engine expects.
 * Unused MediaPipe slots stay at visibility 0 so measureFrame skips them.
 */
export function imageKeypointsToPoseFrame(
  keypoints: ImageKeypoint[],
  width: number,
  height: number,
): PoseFrame | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 8 || height < 8) return null;
  if (keypoints.length === 0) return null;

  const landmarks = emptyLandmarks();
  let visibleCount = 0;
  for (const [position, keypoint] of keypoints.entries()) {
    const index = landmarkIndex(keypoint, position);
    if (index === null) continue;
    const score = keypoint.score ?? 0;
    landmarks[index] = {
      x: keypoint.x / width,
      y: keypoint.y / height,
      visibility: score,
    };
    if (score >= 0.35) visibleCount += 1;
  }

  if (visibleCount < 4) return null;
  return { width, height, landmarks };
}
