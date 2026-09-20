import { describe, expect, it } from "vitest";
import { holdReadyToCapture, tickHoldFill } from "./liveScanFlow";

describe("hold-to-capture scan", () => {
  it("does not capture until the outline is full while the stance is valid", () => {
    expect(tickHoldFill(0, 400, false)).toBe(0);
    expect(holdReadyToCapture(0.4, false, true)).toBe(false);
    expect(holdReadyToCapture(1, false, true)).toBe(true);
  });
});
