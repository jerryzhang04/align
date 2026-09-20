import type { Measurement, ModelGuidanceDraft } from "@align/contracts";
import { validateGuidanceDraft } from "./guidancePolicy.js";

const LABELS: Record<string, string> = {
  shoulder_line_tilt: "shoulder line tilt",
  head_line_tilt: "head line tilt",
  head_shoulder_offset: "head-to-shoulder offset",
  trunk_lean: "trunk lean",
  knee_flexion: "knee flexion",
  frontal_knee_alignment: "frontal knee alignment",
  arm_elevation: "arm elevation",
};

export function localWellnessDraft(measurements: Measurement[]): ModelGuidanceDraft {
  const quoted = measurements.filter((item) => item.unit === "deg").slice(0, 3);
  return {
    summary: quoted.length
      ? "This recap uses projected camera angles plus general wellness sources. It is not a clinical examination or medical assessment."
      : "This recap uses general wellness sources. No verified posture angles were available. It is not a clinical examination.",
    observations: quoted.map((item, index) => ({
      id: `local-obs-${index + 1}`,
      text: `${item.view} ${LABELS[item.id] ?? item.id.replaceAll("_", " ")} is ${item.value.toFixed(1)} degrees from pose landmarks on the phone image.`,
      basedOnViews: [item.view],
      limitations: item.limitations.slice(0, 4),
    })),
    actions: [
      {
        id: "vary-position",
        title: "Change positions during the day",
        instruction: "Alternate sitting and standing, and take short movement breaks. Stop if you feel pain, dizziness, numbness, or weakness.",
        rationale: "There is no single working posture that is uniquely correct for long periods.",
        sourceIds: ["ccohs-working-posture"],
      },
      {
        id: "limit-sitting",
        title: "Replace some sitting with movement",
        instruction: "Break up long sitting with walking or another comfortable activity you already tolerate.",
        rationale: "Adults benefit from regular activity and from limiting uninterrupted sedentary time.",
        sourceIds: ["who-physical-activity-2020"],
      },
      {
        id: "no-posture-blame",
        title: "Do not treat this image as a pain cause",
        instruction: "If symptoms persist, worsen, or limit daily activity, seek assessment from a qualified health professional.",
        rationale: "Reviews do not establish that a specific spinal posture causes low back pain.",
        sourceIds: ["swain-posture-lbp-2020"],
      },
    ],
    limitations: ["This local recap does not use OMNI speech."],
    safetySignalIds: [],
  };
}

export function localWellnessCore(measurements: Measurement[]) {
  return validateGuidanceDraft(localWellnessDraft(measurements), measurements);
}

export function localCoachText(measurements: Measurement[]) {
  const quoted = measurements.filter((item) => item.unit === "deg").slice(0, 2)
    .map((item) => `${LABELS[item.id] ?? item.id.replaceAll("_", " ")} ${item.value.toFixed(1)} degrees on ${item.view}`)
    .join("; ");
  if (quoted) {
    return `I reviewed this frame. Measured ${quoted}. This is general wellness guidance, not medical advice. Change positions during the day and stop if anything hurts.`;
  }
  return "I heard your question. This is general wellness guidance, not medical advice. Change positions during the day, and seek care for persistent pain, numbness, or weakness.";
}
