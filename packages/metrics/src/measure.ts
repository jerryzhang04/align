import type { Measurement, MeasurementId, ViewId } from "@align/contracts";
import { DEFINITION_VERSION } from "@align/contracts";
import {
  distance,
  internalAngleDeg,
  meanAbsoluteDeviation,
  median,
  midpoint,
  segmentInclinationDeg,
  toPixel,
  verticalLeanDeg,
} from "./geometry.js";
import { LANDMARK, both, type PoseFrame, visible } from "./landmarks.js";

const METRIC_VIEWS: Record<MeasurementId, ViewId[]> = {
  shoulder_line_tilt: ["front", "back"],
  head_line_tilt: ["front", "back"],
  head_shoulder_offset: ["right", "left"],
  trunk_lean: ["front", "back", "right", "left"],
  knee_flexion: ["right", "left"],
  frontal_knee_alignment: ["front", "back"],
  arm_elevation: ["front", "right", "left"],
};

function px(frame: PoseFrame, index: number) {
  const point = frame.landmarks[index];
  return toPixel(point.x, point.y, frame.width, frame.height);
}

function nearSide(view: ViewId): "left" | "right" {
  return view === "left" ? "left" : "right";
}

export function measureFrame(frame: PoseFrame, view: ViewId): Partial<Record<MeasurementId, number>> {
  const out: Partial<Record<MeasurementId, number>> = {};
  if (frame.landmarks.length < 33) return out;

  if (METRIC_VIEWS.shoulder_line_tilt.includes(view) && both(frame, LANDMARK.leftShoulder, LANDMARK.rightShoulder)) {
    const tilt = segmentInclinationDeg(px(frame, LANDMARK.leftShoulder), px(frame, LANDMARK.rightShoulder));
    if (tilt !== null) out.shoulder_line_tilt = tilt;
  }

  if (METRIC_VIEWS.head_line_tilt.includes(view) && both(frame, LANDMARK.leftEar, LANDMARK.rightEar, 0.5)) {
    const tilt = segmentInclinationDeg(px(frame, LANDMARK.leftEar), px(frame, LANDMARK.rightEar));
    if (tilt !== null) out.head_line_tilt = tilt;
  }

  if (METRIC_VIEWS.head_shoulder_offset.includes(view)) {
    const side = nearSide(view);
    const ear = side === "left" ? LANDMARK.leftEar : LANDMARK.rightEar;
    const shoulder = side === "left" ? LANDMARK.leftShoulder : LANDMARK.rightShoulder;
    const hip = side === "left" ? LANDMARK.leftHip : LANDMARK.rightHip;
    if (visible(frame, ear, 0.5) && visible(frame, shoulder) && visible(frame, hip)) {
      const earPt = px(frame, ear);
      const shoulderPt = px(frame, shoulder);
      const hipPt = px(frame, hip);
      const trunk = distance(shoulderPt, hipPt);
      if (trunk > 8) {
        out.head_shoulder_offset = (earPt.x - shoulderPt.x) / trunk;
      }
    }
  }

  if (METRIC_VIEWS.trunk_lean.includes(view) && both(frame, LANDMARK.leftShoulder, LANDMARK.rightShoulder) && both(frame, LANDMARK.leftHip, LANDMARK.rightHip)) {
    const shoulders = midpoint(px(frame, LANDMARK.leftShoulder), px(frame, LANDMARK.rightShoulder));
    const hips = midpoint(px(frame, LANDMARK.leftHip), px(frame, LANDMARK.rightHip));
    const lean = verticalLeanDeg(shoulders, hips);
    if (lean !== null) out.trunk_lean = lean;
  }

  if (METRIC_VIEWS.knee_flexion.includes(view)) {
    const side = nearSide(view);
    const hip = side === "left" ? LANDMARK.leftHip : LANDMARK.rightHip;
    const knee = side === "left" ? LANDMARK.leftKnee : LANDMARK.rightKnee;
    const ankle = side === "left" ? LANDMARK.leftAnkle : LANDMARK.rightAnkle;
    if (visible(frame, hip) && visible(frame, knee) && visible(frame, ankle)) {
      const angle = internalAngleDeg(px(frame, hip), px(frame, knee), px(frame, ankle));
      if (angle !== null) out.knee_flexion = 180 - angle;
    }
  }

  if (METRIC_VIEWS.frontal_knee_alignment.includes(view)) {
    for (const side of ["left", "right"] as const) {
      const hip = side === "left" ? LANDMARK.leftHip : LANDMARK.rightHip;
      const knee = side === "left" ? LANDMARK.leftKnee : LANDMARK.rightKnee;
      const ankle = side === "left" ? LANDMARK.leftAnkle : LANDMARK.rightAnkle;
      if (visible(frame, hip) && visible(frame, knee) && visible(frame, ankle)) {
        const hipPt = px(frame, hip);
        const kneePt = px(frame, knee);
        const anklePt = px(frame, ankle);
        const dx = anklePt.x - hipPt.x;
        const dy = anklePt.y - hipPt.y;
        if (Math.hypot(dx, dy) < 8) continue;
        const t = ((kneePt.x - hipPt.x) * dx + (kneePt.y - hipPt.y) * dy) / (dx * dx + dy * dy);
        const projX = hipPt.x + t * dx;
        const signed = (kneePt.x - projX) / distance(hipPt, anklePt);
        if (out.frontal_knee_alignment === undefined) {
          out.frontal_knee_alignment = signed;
        } else {
          out.frontal_knee_alignment = (out.frontal_knee_alignment + signed) / 2;
        }
      }
    }
  }

  if (METRIC_VIEWS.arm_elevation.includes(view)) {
    const side = view === "left" ? "left" : view === "right" ? "right" : "right";
    const shoulder = side === "left" ? LANDMARK.leftShoulder : LANDMARK.rightShoulder;
    const elbow = side === "left" ? LANDMARK.leftElbow : LANDMARK.rightElbow;
    const hip = side === "left" ? LANDMARK.leftHip : LANDMARK.rightHip;
    if (visible(frame, shoulder) && visible(frame, elbow) && visible(frame, hip)) {
      const angle = internalAngleDeg(px(frame, hip), px(frame, shoulder), px(frame, elbow));
      if (angle !== null) out.arm_elevation = angle;
    }
  }

  return out;
}

const LIMITATIONS: Record<MeasurementId, string[]> = {
  shoulder_line_tilt: ["Projected shoulder line; camera roll changes the value."],
  head_line_tilt: ["Requires both ears. Not a cranial diagnosis."],
  head_shoulder_offset: ["Side-view proxy, not a C7 craniovertebral angle."],
  trunk_lean: ["Surface landmark proxy, not spinal curvature."],
  knee_flexion: ["Projected magnitude; hyperextension is not labeled yet."],
  frontal_knee_alignment: ["Projected alignment only; rotation and perspective change it."],
  arm_elevation: ["Movement angle proxy, not isolated glenohumeral ROM."],
};

const UNITS: Record<MeasurementId, Measurement["unit"]> = {
  shoulder_line_tilt: "deg",
  head_line_tilt: "deg",
  head_shoulder_offset: "ratio",
  trunk_lean: "deg",
  knee_flexion: "deg",
  frontal_knee_alignment: "ratio",
  arm_elevation: "deg",
};

export type AggregateOptions = {
  /** Hold protocol default is 8. Still-image scans pass 1. */
  minSamplesForUsable?: number;
  extraLimitations?: string[];
};

export function aggregateMeasurements(
  frames: PoseFrame[],
  view: ViewId,
  options: AggregateOptions = {},
): Measurement[] {
  const minSamplesForUsable = options.minSamplesForUsable ?? 8;
  const extra = options.extraLimitations ?? [];
  const buckets = new Map<MeasurementId, number[]>();
  for (const frame of frames) {
    const measured = measureFrame(frame, view);
    for (const [id, value] of Object.entries(measured) as [MeasurementId, number][]) {
      const list = buckets.get(id) ?? [];
      list.push(value);
      buckets.set(id, list);
    }
  }

  const results: Measurement[] = [];
  for (const [id, values] of buckets) {
    const center = median(values);
    if (center === null) continue;
    const spread = meanAbsoluteDeviation(values, center);
    const limited = values.length < minSamplesForUsable || spread > (UNITS[id] === "deg" ? 8 : 0.08);
    results.push({
      id,
      value: Number(center.toFixed(UNITS[id] === "deg" ? 1 : 3)),
      unit: UNITS[id],
      view,
      definitionVersion: DEFINITION_VERSION,
      sampleCount: values.length,
      quality: limited ? "limited" : "usable",
      limitations: [...LIMITATIONS[id], ...extra],
    });
  }
  return results;
}
