import { describe, expect, it } from "vitest";
import { CAPTURE_VIEWS, advanceCapture, captureProgress } from "./captureFlow";

describe("capture flow", () => {
  it("uses the fixed front, right, back, left protocol", () => {
    expect(CAPTURE_VIEWS.map((view) => view.id)).toEqual(["front", "right", "back", "left"]);
  });

  it("advances through every view and then completes", () => {
    expect(advanceCapture("front")).toBe("right");
    expect(advanceCapture("right")).toBe("back");
    expect(advanceCapture("back")).toBe("left");
    expect(advanceCapture("left")).toBe("complete");
  });

  it("reports accepted-view progress without treating it as posture quality", () => {
    expect(captureProgress({ front: "a.jpg", back: "b.jpg" })).toEqual({ accepted: 2, total: 4 });
  });
});
