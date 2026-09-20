import type { Measurement, ModelGuidanceDraft } from "@align/contracts";
import { practiceProfile, practiceScoreInts, type PracticeAreaScore } from "@align/metrics";
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

function formatMeasured(item: Measurement) {
  if (item.unit === "deg") return `${item.value.toFixed(1)} degrees`;
  return item.value.toFixed(3);
}

function observationFromArea(area: PracticeAreaScore, measurements: Measurement[], index: number) {
  const measured = measurements.find((row) => row.id === area.measurementId && row.view === area.view);
  return {
    id: `local-obs-${index + 1}`,
    text: measured
      ? `${area.view} ${area.label.toLowerCase()} is ${area.score}/100 (${formatMeasured(measured)}). ${area.whyCommon}`
      : `${area.view} ${area.label.toLowerCase()} is ${area.score}/100. ${area.whyCommon}`,
    basedOnViews: [area.view] as Measurement["view"][],
    limitations: (measured?.limitations ?? ["Projected camera landmarks."]).slice(0, 4),
  };
}

export function localWellnessDraft(measurements: Measurement[]): ModelGuidanceDraft {
  const scores = practiceProfile(measurements);
  const focus = scores.areas.filter((area) => area.score < 90).slice(0, 3);
  const observationSource = focus.length ? focus : scores.areas.slice(0, 3);
  const observations = observationSource.length
    ? observationSource.map((area, index) => observationFromArea(area, measurements, index))
    : measurements.filter((item) => item.unit === "deg").slice(0, 3).map((item, index) => ({
      id: `local-obs-${index + 1}`,
      text: `${item.view} ${LABELS[item.id] ?? item.id.replaceAll("_", " ")} is ${formatMeasured(item)} from pose landmarks on the phone image.`,
      basedOnViews: [item.view] as Measurement["view"][],
      limitations: item.limitations.slice(0, 4),
    }));

  const actions = observationSource.slice(0, 2).map((area, index) => ({
    id: `practice-${area.id}`,
    title: area.label,
    instruction: area.improve,
    rationale: area.whyCommon,
    sourceIds: [index === 0 ? "ccohs-working-posture" : "who-physical-activity-2020"],
  }));

  if (!actions.some((action) => action.id === "vary-position")) {
    actions.push({
      id: "vary-position",
      title: "Change positions during the day",
      instruction: "Alternate sitting and standing, and take short movement breaks. Stop if you feel pain, dizziness, numbness, or weakness.",
      rationale: "There is no single working posture that is uniquely correct for long periods.",
      sourceIds: ["ccohs-working-posture"],
    });
  }

  const lowest = focus[0] ?? scores.areas[0];
  return {
    summary: scores.areas.length && lowest
      ? `Your photos score ${scores.overall}/100 for camera alignment practice. Lowest area: ${lowest.label} at ${lowest.score}/100. Use the notes below as everyday good practice.`
      : "These photos were not clear enough for a camera-alignment score. Use everyday good practice: change positions often and stop if anything hurts.",
    observations,
    actions: actions.slice(0, 3),
    limitations: ["This local recap does not use OMNI speech."],
    safetySignalIds: [],
  };
}

export function localWellnessCore(measurements: Measurement[]) {
  const scores = practiceProfile(measurements);
  return validateGuidanceDraft(localWellnessDraft(measurements), measurements, practiceScoreInts(scores));
}

export function localCoachText(measurements: Measurement[]) {
  const scores = practiceProfile(measurements);
  if (scores.areas.length) {
    const lowest = scores.areas[0]!;
    return `I reviewed this frame. Camera alignment practice is ${scores.overall}/100. ${lowest.label} is ${lowest.score}/100. Good practice: ${lowest.improve}`;
  }
  const quoted = measurements.filter((item) => item.unit === "deg").slice(0, 2)
    .map((item) => `${LABELS[item.id] ?? item.id.replaceAll("_", " ")} ${item.value.toFixed(1)} degrees on ${item.view}`)
    .join("; ");
  if (quoted) {
    return `I reviewed this frame. Measured ${quoted}. Good practice: change positions during the day and stop if anything hurts.`;
  }
  return "I heard your question. Good practice: change positions during the day, and seek care for persistent pain, numbness, or weakness.";
}
