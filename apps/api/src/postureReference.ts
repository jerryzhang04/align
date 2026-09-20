import type { Measurement } from "@align/contracts";

// These are qualitative ergonomic references, not diagnostic thresholds or a second metric engine.
const REFERENCES: Record<string, { sourceId: string; reference: string; limit: string }> = {
  shoulder_line_tilt: { sourceId: "osha-neutral-workstation", reference: "Comfortable working shoulders are relaxed, with upper arms near the torso.", limit: "A sloped shoulder line does not establish shoulder tension, a habit, or a cause of pain." },
  head_line_tilt: { sourceId: "osha-neutral-workstation", reference: "For computer work, aim for a comfortably balanced, forward-facing head.", limit: "A frontal head line cannot establish neck curvature or identify a workstation problem." },
  head_shoulder_offset: { sourceId: "osha-neutral-workstation", reference: "A comfortable computer-working reference places the head and neck in line with the torso.", limit: "Projected ear-to-shoulder offset depends on camera angle; it is not a clinical forward-head diagnosis." },
  trunk_lean: { sourceId: "ccohs-standing", reference: "Standing work should permit comfortable balanced positions, easy reach, and frequent position changes.", limit: "Leaning in a photo may be intentional. Do not demand rigid vertical alignment or infer daily habits." },
  knee_flexion: { sourceId: "ccohs-standing", reference: "Standing work should allow varied positions and opportunities to sit or shift weight.", limit: "These sources supply no normal knee-angle cutoff for a standing photograph; do not label this measurement abnormal." },
  frontal_knee_alignment: { sourceId: "ccohs-standing", reference: "Standing comfort depends on task, reach, and freedom to change position.", limit: "These sources do not establish a normal projected knee-alignment ratio; do not prescribe a correction from it." },
  arm_elevation: { sourceId: "ccohs-standing", reference: "Arrange standing work to avoid prolonged overreaching and work above shoulder height.", limit: "A raised arm in a posed photograph does not establish repeated occupational exposure." },
};

export const PERSONALIZATION_RULES = [
  "Use each submission's actual views, verified findings, measurement limitations, and any spoken goal. Do not recycle a default exercise list.",
  "For each action, explain in its rationale which visible observation, measured finding (name and view), or explicitly spoken goal makes it relevant. Cite the supporting source ID.",
  "Separate a visible observation from an ergonomic suggestion. Do not infer work habits, symptoms, duration, age, medical history, or pain causality from appearance.",
  "If views conflict or confidence is limited, explain uncertainty and suggest a better capture instead of corrective advice. If no specific change is supported, say so.",
  "There is no single ideal posture for every person or task. These qualitative references are not a clinical normal range, an ideal-body template, or a validated numerical baseline.",
  "Do not quote practice scores as health findings. No longitudinal user baseline is supplied: never claim improvement, deterioration, or knowledge of earlier scans.",
].join("\n");

export function postureReferenceContext(measurements: Measurement[]): string {
  if (!measurements.length) return "No measured findings: discuss only clearly visible features or the spoken goal; do not invent a baseline comparison.";
  return JSON.stringify(measurements.map((measurement) => ({
    measurement,
    ...(REFERENCES[measurement.id] ?? { sourceId: "ccohs-working-posture", reference: "Vary comfortable working positions.", limit: "No specific comparison reference is available for this measurement." }),
    baselineType: "Qualitative ergonomic reference, not a clinical normal range",
  })));
}
