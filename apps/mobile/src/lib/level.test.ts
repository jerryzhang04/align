import { describe, expect, it } from "vitest";
import { assessHorizon } from "./level";

describe("assessHorizon", () => {
  it("accepts a phone within the level tolerance", () => {
    expect(assessHorizon(Math.PI / 90)).toEqual({
      isLevel: true,
      rollDegrees: 2,
      direction: "level",
      message: "Phone is level",
    });
  });

  it("coaches a clockwise tilt back toward level", () => {
    expect(assessHorizon(Math.PI / 12)).toMatchObject({
      isLevel: false,
      rollDegrees: 15,
      direction: "counterclockwise",
    });
  });

  it("coaches a counterclockwise tilt back toward level", () => {
    expect(assessHorizon(-Math.PI / 12)).toMatchObject({
      isLevel: false,
      rollDegrees: -15,
      direction: "clockwise",
    });
  });
});
