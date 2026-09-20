import { guidanceReportSchema, type GuidanceReport, type Measurement } from "@align/contracts";

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

export function localWellnessReport(input: {
  requestId: string;
  measurements: Measurement[];
}): GuidanceReport {
  const quoted = input.measurements.filter((item) => item.unit === "deg").slice(0, 3);
  const observations = quoted.map((item, index) => ({
    id: `local-obs-${index + 1}`,
    text: `${item.view} ${LABELS[item.id] ?? item.id.replaceAll("_", " ")} is ${item.value.toFixed(1)} degrees from pose landmarks on the phone image.`,
    basedOnViews: [item.view],
    limitations: item.limitations.slice(0, 4),
  }));

  return guidanceReportSchema.parse({
    requestId: input.requestId,
    summary: quoted.length
      ? "This recap uses projected camera angles plus general wellness sources. It is not a clinical examination or medical assessment."
      : "This recap uses general wellness sources. No verified posture angles were available. It is not a clinical examination.",
    observations,
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
    limitations: [
      "This recap is wellness guidance from reviewed sources, not a medical device output.",
      "Sequential phone images are not a clinical examination.",
      "Appearance alone does not establish the cause of pain.",
      quoted.length ? "Quoted angles come from pose landmarks on phone images, not a clinical examination." : "No verified posture angle was produced.",
    ],
    safety: {
      level: "wellness",
      message: "This is general wellness guidance based on a short phone capture, not medical advice.",
      signalIds: [],
    },
    sources: SOURCES,
    measurements: input.measurements,
    pose: { source: "none", viewsWithPose: [] },
    speechProvider: "none",
    providerMode: "unconfigured",
    model: "local-evidence",
    latencyMs: 0,
    degraded: true,
  });
}
