import { guidanceReportSchema, type GuidanceReport, type Measurement } from "@align/contracts";
import { practiceProfile } from "@align/metrics/practiceScore";

const SOURCES = [
  {
    id: "ccohs-working-posture",
    title: "Working in a Sitting Position — Basic Requirements",
    publisher: "Canadian Centre for Occupational Health and Safety",
    url: "https://www.ccohs.ca/oshanswers/ergonomics/sitting/sitting_basic.html",
    level: "occupational-guidance" as const,
    reviewedAt: "2026-09-19",
  },
  {
    id: "who-physical-activity-2020",
    title: "WHO guidelines on physical activity and sedentary behaviour",
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789240014886",
    level: "guideline" as const,
    reviewedAt: "2026-09-19",
  },
  {
    id: "swain-posture-lbp-2020",
    title: "No consensus on causality of spine postures or physical exposure and low back pain",
    publisher: "Journal of Biomechanics",
    url: "https://pubmed.ncbi.nlm.nih.gov/31451200/",
    level: "systematic-review" as const,
    reviewedAt: "2026-09-19",
  },
];

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

export function localWellnessReport(input: {
  requestId: string;
  measurements: Measurement[];
}): GuidanceReport {
  const scores = practiceProfile(input.measurements);
  const focus = scores.areas.filter((area) => area.score < 90).slice(0, 3);
  const observationSource = focus.length ? focus : scores.areas.slice(0, 3);
  const observations = observationSource.length
    ? observationSource.map((area, index) => {
      const measured = input.measurements.find((row) => row.id === area.measurementId && row.view === area.view);
      return {
        id: `local-obs-${index + 1}`,
        text: measured
          ? `${area.view} ${area.label.toLowerCase()} is ${area.score}/100 (${formatMeasured(measured)}). ${area.whyCommon}`
          : `${area.view} ${area.label.toLowerCase()} is ${area.score}/100. ${area.whyCommon}`,
        basedOnViews: [area.view] as Measurement["view"][],
        limitations: (measured?.limitations ?? ["Projected camera landmarks."]).slice(0, 4),
      };
    })
    : input.measurements.filter((item) => item.unit === "deg").slice(0, 3).map((item, index) => ({
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
  actions.push({
    id: "vary-position",
    title: "Change positions during the day",
    instruction: "Alternate sitting and standing, and take short movement breaks. Stop if you feel pain, dizziness, numbness, or weakness.",
    rationale: "There is no single working posture that is uniquely correct for long periods.",
    sourceIds: ["ccohs-working-posture"],
  });

  const lowest = focus[0] ?? scores.areas[0];
  return guidanceReportSchema.parse({
    requestId: input.requestId,
    summary: scores.areas.length && lowest
      ? `Your photos score ${scores.overall}/100 for camera alignment practice. Lowest area: ${lowest.label} at ${lowest.score}/100. Use the notes below as everyday good practice.`
      : "These photos were not clear enough for a camera-alignment score. Use everyday good practice: change positions often and stop if anything hurts.",
    observations,
    actions: actions.slice(0, 3),
    limitations: [
      "This recap is everyday alignment practice from a short phone capture.",
      "Sequential phone images are not a clinical examination.",
      "Appearance alone does not establish the cause of pain.",
      scores.areas.length ? "Quoted scores come from pose landmarks on phone images." : "No verified posture angle was produced.",
    ],
    safety: {
      level: "wellness",
      message: "This recap is everyday alignment practice from a short phone capture.",
      signalIds: [],
    },
    sources: SOURCES,
    measurements: input.measurements,
    pose: { source: "none", viewsWithPose: [] },
    practiceScores: scores.areas.length ? scores : null,
    speechProvider: "none",
    providerMode: "unconfigured",
    model: "local-evidence",
    latencyMs: 0,
    degraded: true,
  });
}
