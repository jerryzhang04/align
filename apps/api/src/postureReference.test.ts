import { expect, it } from "vitest";
import { postureReferenceContext } from "./postureReference.js";
import type { Measurement } from "@align/contracts";
const finding = (id: string, value: number): Measurement => ({ id, value, unit: "deg", view: "front", quality: "limited", definitionVersion: "test", sampleCount: 1, limitations: ["Camera projection"] });
it("selects references for this scan without inventing a normative cutoff", () => {
  const shoulder = postureReferenceContext([finding("shoulder_line_tilt", 4)]);
  const trunk = postureReferenceContext([finding("trunk_lean", 8)]);
  expect(shoulder).toContain("osha-neutral-workstation");
  expect(shoulder).toContain("shoulder_line_tilt");
  expect(trunk).toContain("ccohs-standing");
  expect(trunk).not.toEqual(shoulder);
  expect(shoulder).toContain("Camera projection");
  expect(shoulder).toContain("not a clinical normal range");
});
it("does not invent a finding when landmarks are missing", () => {
  expect(postureReferenceContext([])).toContain("No measured findings");
});
