export const LANDMARK = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type LandmarkSample = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

export type PoseFrame = {
  width: number;
  height: number;
  landmarks: LandmarkSample[];
};

export function visible(frame: PoseFrame, index: number, threshold = 0.55): boolean {
  const point = frame.landmarks[index];
  if (!point) return false;
  const score = point.visibility ?? point.presence ?? 1;
  return score >= threshold && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export function both(frame: PoseFrame, a: number, b: number, threshold?: number): boolean {
  return visible(frame, a, threshold) && visible(frame, b, threshold);
}
