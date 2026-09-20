import { describe, expect, it } from "vitest";
import { holdFill, holdReadyToCapture, VIEW_HOLD_MS } from "./liveScanFlow";

describe("hold-to-capture scan", () => {
  it("fills the current outline until a photo can be taken", () => {
    expect(holdFill(0)).toBe(0);
    expect(holdReadyToCapture(VIEW_HOLD_MS - 10, false)).toBe(false);
    expect(holdReadyToCapture(VIEW_HOLD_MS, false)).toBe(true);
  });
});
