import type { ViewId } from "@align/contracts";
import { LANDMARK, both, type PoseFrame, visible } from "./landmarks.js";

export type QualityIssue = {
  code: string;
  message: string;
};

export type QualityResult = {
  ok: boolean;
  issues: QualityIssue[];
};

function inFrame(frame: PoseFrame, index: number, margin = 0.04): boolean {
  const point = frame.landmarks[index];
  if (!point) return false;
  return point.x > margin && point.x < 1 - margin && point.y > margin && point.y < 1 - margin;
}

export function assessFrame(frame: PoseFrame, view: ViewId): QualityResult {
  const issues: QualityIssue[] = [];
  if (frame.landmarks.length < 33) {
    return { ok: false, issues: [{ code: "no_pose", message: "No full pose yet. Step into the frame." }] };
  }

  const feet = [LANDMARK.leftAnkle, LANDMARK.rightAnkle];
  const head = [LANDMARK.nose, LANDMARK.leftEar, LANDMARK.rightEar];
  if (!feet.some((index) => visible(frame, index, 0.4) && inFrame(frame, index, 0.02))) {
    issues.push({ code: "crop_feet", message: "Show both feet. Step back if they are cut off." });
  }
  if (!head.some((index) => visible(frame, index, 0.4) && inFrame(frame, index, 0.02))) {
    issues.push({ code: "crop_head", message: "Show your head. Move back until hair to shoes is visible." });
  }

  if (view === "front" || view === "back") {
    if (!both(frame, LANDMARK.leftShoulder, LANDMARK.rightShoulder, 0.5)) {
      issues.push({ code: "shoulders", message: "Face the camera squarely so both shoulders are visible." });
    }
    const left = frame.landmarks[LANDMARK.leftShoulder];
    const right = frame.landmarks[LANDMARK.rightShoulder];
    if (left && right && Math.abs(left.x - right.x) < 0.08) {
      issues.push({ code: "not_frontal", message: "Turn to a square front or back view, not a side view." });
    }
  } else {
    const side = view === "left" ? "left" : "right";
    const shoulder = side === "left" ? LANDMARK.leftShoulder : LANDMARK.rightShoulder;
    const hip = side === "left" ? LANDMARK.leftHip : LANDMARK.rightHip;
    const ankle = side === "left" ? LANDMARK.leftAnkle : LANDMARK.rightAnkle;
    if (!visible(frame, shoulder, 0.45) || !visible(frame, hip, 0.45) || !visible(frame, ankle, 0.4)) {
      issues.push({ code: "side_joints", message: `Turn ${view} so the near hip, knee, and ankle are visible.` });
    }
    const left = frame.landmarks[LANDMARK.leftShoulder];
    const right = frame.landmarks[LANDMARK.rightShoulder];
    if (left && right && Math.abs(left.x - right.x) > 0.18) {
      issues.push({ code: "not_side", message: "This looks frontal. Turn 90 degrees for a side view." });
    }
  }

  return { ok: issues.length === 0, issues };
}

function visiblePoint(frame: PoseFrame, index: number, threshold = 0.4) {
  return visible(frame, index, threshold) ? frame.landmarks[index] : null;
}

function bodySpan(frame: PoseFrame): { height: number; midX: number } | null {
  const head = visiblePoint(frame, LANDMARK.nose) ?? visiblePoint(frame, LANDMARK.leftEar) ?? visiblePoint(frame, LANDMARK.rightEar);
  const leftAnkle = visiblePoint(frame, LANDMARK.leftAnkle);
  const rightAnkle = visiblePoint(frame, LANDMARK.rightAnkle);
  const ankle = leftAnkle && rightAnkle
    ? (leftAnkle.y >= rightAnkle.y ? leftAnkle : rightAnkle)
    : leftAnkle ?? rightAnkle;
  const leftShoulder = visiblePoint(frame, LANDMARK.leftShoulder, 0.45);
  const rightShoulder = visiblePoint(frame, LANDMARK.rightShoulder, 0.45);
  const leftHip = visiblePoint(frame, LANDMARK.leftHip, 0.45);
  const rightHip = visiblePoint(frame, LANDMARK.rightHip, 0.45);
  if (!head || !ankle) return null;
  const xs = [head.x, ankle.x, leftShoulder?.x, rightShoulder?.x, leftHip?.x, rightHip?.x].filter((value): value is number => typeof value === "number");
  const midX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  return { height: ankle.y - head.y, midX };
}

/**
 * Capture-only framing checks. The guide occupies the clear area between controls;
 * allow a full body there without requiring it to fill most of the camera height.
 * Landmark confidence and measurement acceptance remain in assessFrame/measureFrame.
 */
export function fitBodyGuide(frame: PoseFrame, view: ViewId): QualityResult {
  const quality = assessFrame(frame, view);
  const issues = [...quality.issues];
  const span = bodySpan(frame);
  if (!span) {
    issues.push({ code: "no_pose", message: "Step into the outline so your whole body is visible." });
  } else {
    if (span.height < 0.38) {
      issues.push({ code: "too_far", message: "Step closer so your whole body is easier to see." });
    } else if (span.height > 0.92) {
      issues.push({ code: "too_close", message: "Step back so your head and feet stay inside the camera." });
    }
    if (Math.abs(span.midX - 0.5) > 0.16) {
      issues.push({ code: "off_center", message: "Move toward the center of the camera." });
    }
  }
  const unique = issues.filter((issue, index) => issues.findIndex((item) => item.code === issue.code) === index);
  return { ok: unique.length === 0, issues: unique };
}

export function motionScore(previous: PoseFrame | null, current: PoseFrame): number {
  if (!previous || previous.landmarks.length < 33 || current.landmarks.length < 33) return 1;
  const keys = [LANDMARK.leftShoulder, LANDMARK.rightShoulder, LANDMARK.leftHip, LANDMARK.rightHip];
  let total = 0;
  for (const index of keys) {
    const a = previous.landmarks[index];
    const b = current.landmarks[index];
    total += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return total / keys.length;
}
