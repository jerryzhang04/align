import { modelGuidanceDraftSchema, type Measurement, type ModelGuidanceDraft } from "@align/contracts";
import { resolveEvidence } from "./evidence.js";

const forbidden = /\b(diagnos(?:e|is|ed)|scoliosis|kyphosis|lordosis|pelvic tilt|leg[- ]length discrepancy|muscle weakness|spinal deformity)\b/i;
const numericFinding = /\b\d+(?:\.\d+)?\s*(?:°|degrees?|mm|cm|%|percent)\b/i;
const unverifiedPrecision = /\b\d+(?:\.\d+)?\s*(?:mm|cm|%|percent)\b/i;
const urgent = new Set(["bladder_bowel_change", "saddle_numbness", "bilateral_limb_weakness", "significant_trauma", "chest_pain"]);
const professional = new Set(["persistent_pain", "recurring_numbness", "progressive_weakness", "functional_limitation"]);
const allowedSignals = new Set([...urgent, ...professional]);

const STANDARD_LIMITATIONS = [
  "Sequential phone images are not a clinical examination.",
  "Appearance alone does not establish the cause of pain.",
  "Stop any suggested movement that causes pain, dizziness, numbness, or weakness.",
];
const NO_VERIFIED_ANGLE = "No diagnosis or verified posture angle was produced.";
const PROJECTED_ANGLE = "Quoted angles come from pose landmarks on phone images, not a clinical examination.";

export function validateGuidanceDraft(input: unknown, measurements: Measurement[] = [], practiceScores: number[] = []) {
  const draft: ModelGuidanceDraft = modelGuidanceDraftSchema.parse(input);
  const allText = [
    draft.summary,
    ...draft.observations.flatMap((item) => [item.text, ...item.limitations]),
    ...draft.actions.flatMap((item) => [item.title, item.instruction, item.rationale]),
  ].join(" ");
  if (forbidden.test(allText)) throw new Error("forbidden_medical_claim");
  if ((measurements.length ? unverifiedPrecision : numericFinding).test(allText)) throw new Error("invented_numeric_finding");
  const quotedScores = [...allText.matchAll(/\b(\d{1,3})\s*\/\s*100\b/g)].map((match) => Number(match[1]));
  const allowedScores = new Set(practiceScores.filter((value) => Number.isInteger(value)));
  if (quotedScores.some((value) => !allowedScores.has(value))) throw new Error("invented_numeric_finding");
  if (draft.safetySignalIds.some((id) => !allowedSignals.has(id))) throw new Error("unknown_safety_signal");

  const sourceIds = draft.actions.flatMap((action) => action.sourceIds);
  const sources = resolveEvidence(sourceIds);
  const hasUrgent = draft.safetySignalIds.some((id) => urgent.has(id));
  const hasProfessional = draft.safetySignalIds.some((id) => professional.has(id));
  const safety = hasUrgent
    ? {
        level: "urgent-care" as const,
        message: "Your description includes a warning symptom that needs urgent local medical assessment. Align cannot determine the cause. Contact emergency or urgent medical services now.",
        signalIds: draft.safetySignalIds,
      }
    : hasProfessional
      ? {
          level: "seek-professional-care" as const,
          message: "Consider an assessment from a qualified health professional, especially if this is persistent, worsening, or limiting normal activity.",
          signalIds: draft.safetySignalIds,
        }
      : {
          level: "wellness" as const,
          message: "This recap is everyday alignment practice from a short phone capture.",
          signalIds: [],
        };

  return {
    summary: draft.summary,
    observations: draft.observations,
    actions: hasUrgent ? [] : draft.actions,
    limitations: [...new Set([
      ...draft.limitations,
      ...STANDARD_LIMITATIONS,
      measurements.length ? PROJECTED_ANGLE : NO_VERIFIED_ANGLE,
    ])],
    safety,
    sources: hasUrgent
      ? resolveEvidence(["nice-neurological-referral-ng127", "nhs-back-pain-warning-signs"])
      : sources,
  };
}
