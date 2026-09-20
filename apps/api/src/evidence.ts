import type { EvidenceCitation } from "@align/contracts";

type EvidenceEntry = EvidenceCitation & { claim: string; caution: string };

export const EVIDENCE_CATALOG: EvidenceEntry[] = [
  {
    id: "who-physical-activity-2020",
    title: "WHO guidelines on physical activity and sedentary behaviour",
    publisher: "World Health Organization",
    url: "https://www.who.int/publications/i/item/9789240014886",
    level: "guideline",
    reviewedAt: "2026-09-19",
    claim: "Adults benefit from regular physical activity and from limiting sedentary time by replacing it with activity at any intensity.",
    caution: "Do not turn population guidance into a personalized exercise prescription.",
  },
  {
    id: "ccohs-working-posture",
    title: "Working in a Sitting Position — Basic Requirements",
    publisher: "Canadian Centre for Occupational Health and Safety",
    url: "https://www.ccohs.ca/oshanswers/ergonomics/sitting/sitting_basic.html",
    level: "occupational-guidance",
    reviewedAt: "2026-09-19",
    claim: "There is no single uniquely correct working posture for an extended period; work should permit varied, balanced positions and frequent changes.",
    caution: "A camera image cannot determine whether a workstation is safe or suitable.",
  },
  {
    id: "swain-posture-lbp-2020",
    title: "No consensus on causality of spine postures or physical exposure and low back pain",
    publisher: "Journal of Biomechanics",
    url: "https://pubmed.ncbi.nlm.nih.gov/31451200/",
    level: "systematic-review",
    reviewedAt: "2026-09-19",
    claim: "Available systematic reviews do not establish that a specific spinal posture causes low back pain.",
    caution: "Do not claim that an observed posture caused current or future pain.",
  },
  {
    id: "nice-neurological-referral-ng127",
    title: "Suspected neurological conditions: recognition and referral",
    publisher: "National Institute for Health and Care Excellence",
    url: "https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16",
    level: "guideline",
    reviewedAt: "2026-09-19",
    claim: "New bladder, bowel, sexual-function, perineal-sensation, or rapidly progressive weakness symptoms can require immediate assessment.",
    caution: "Escalate the symptom; do not name or rule out a diagnosis.",
  },
  {
    id: "nhs-back-pain-warning-signs",
    title: "Back pain",
    publisher: "NHS",
    url: "https://www.nhs.uk/conditions/back-pain/",
    level: "guideline",
    reviewedAt: "2026-09-19",
    claim: "Back pain with bilateral weakness or numbness, saddle-area sensory change, bladder or bowel change, chest pain, or serious trauma needs urgent assessment.",
    caution: "General information cannot replace an individual clinical assessment.",
  },
];

const byId = new Map(EVIDENCE_CATALOG.map((entry) => [entry.id, entry]));

export function resolveEvidence(ids: string[]): EvidenceCitation[] {
  return [...new Set(ids)].map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error("unknown_evidence_source");
    const { claim: _claim, caution: _caution, ...citation } = entry;
    return citation;
  });
}

export function evidencePromptContext(): string {
  return EVIDENCE_CATALOG.map((entry) =>
    `[${entry.id}] ${entry.claim} Caution: ${entry.caution}`,
  ).join("\n");
}
