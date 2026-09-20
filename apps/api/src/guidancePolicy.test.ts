import { describe, expect, it } from "vitest";
import { validateGuidanceDraft } from "./guidancePolicy.js";

const safeDraft = {
  summary: "Your four views are suitable for a general wellness review.",
  observations: [{ id: "o1", text: "Your shoulder line appears different between the front and back views.", basedOnViews: ["front", "back"] as const, limitations: ["Camera angle can change appearance."] }],
  actions: [{ id: "a1", title: "Change positions", instruction: "Vary your position during the day.", rationale: "No single working posture is suitable for everyone for long periods.", sourceIds: ["ccohs-working-posture"] }],
  limitations: ["This is not a clinical examination."],
  safetySignalIds: [],
};

describe("validateGuidanceDraft", () => {
  it("resolves only registered evidence", () => {
    const result = validateGuidanceDraft(safeDraft);
    expect(result.sources.map((source) => source.id)).toEqual(["ccohs-working-posture"]);
  });

  it("rejects diagnostic language", () => {
    expect(() => validateGuidanceDraft({ ...safeDraft, summary: "This shows scoliosis." })).toThrow("forbidden_medical_claim");
  });

  it("rejects invented numeric findings", () => {
    expect(() => validateGuidanceDraft({ ...safeDraft, observations: [{ ...safeDraft.observations[0], text: "Your shoulder tilt is 12 degrees." }] })).toThrow("invented_numeric_finding");
  });

  it("turns urgent signals into deterministic escalation and removes wellness actions", () => {
    const result = validateGuidanceDraft({ ...safeDraft, safetySignalIds: ["bladder_bowel_change"] });
    expect(result.safety.level).toBe("urgent-care");
    expect(result.actions).toEqual([]);
  });

  it("rejects invented evidence ids", () => {
    expect(() => validateGuidanceDraft({ ...safeDraft, actions: [{ ...safeDraft.actions[0], sourceIds: ["made-up"] }] })).toThrow("unknown_evidence_source");
  });
});
