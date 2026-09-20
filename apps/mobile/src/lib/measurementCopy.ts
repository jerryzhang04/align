import type { Measurement } from "@align/contracts";

const LABELS: Record<string, string> = {
  shoulder_line_tilt: "Shoulder line tilt",
  head_line_tilt: "Head line tilt",
  head_shoulder_offset: "Head-to-shoulder offset",
  trunk_lean: "Trunk lean",
  knee_flexion: "Knee flexion",
  frontal_knee_alignment: "Frontal knee alignment",
  arm_elevation: "Arm elevation",
};

export function measurementLabel(id: string) {
  return LABELS[id] ?? id.replaceAll("_", " ");
}

export function formatMeasurement(item: Measurement) {
  if (item.unit === "deg") return `${item.value.toFixed(1)}°`;
  if (item.unit === "seconds") return `${item.value.toFixed(1)} s`;
  return item.value.toFixed(3);
}

export function mergeMeasurements(current: Measurement[], incoming: Measurement[]) {
  if (!incoming.length) return current;
  const keys = new Set(incoming.map((item) => `${item.view}:${item.id}`));
  return [...current.filter((item) => !keys.has(`${item.view}:${item.id}`)), ...incoming];
}
