import { describe, expect, it } from "vitest";
import { canRequestGuidance, nextAfterCapture } from "./finalGuidanceFlow";

describe("final scan guidance flow", () => {
  it("moves the fourth capture into the spoken-guidance step", () => {
    expect(nextAfterCapture("left")).toBe("awaiting-guidance");
  });

  it("requires all four captures and cloud consent", () => {
    const captures = { front: "f", right: "r", back: "b", left: "l" };
    expect(canRequestGuidance(captures, true)).toBe(true);
    expect(canRequestGuidance(captures, false)).toBe(false);
    expect(canRequestGuidance({ front: "f" }, true)).toBe(false);
  });
});
