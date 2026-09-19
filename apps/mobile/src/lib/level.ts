export type HorizonDirection = "level" | "clockwise" | "counterclockwise";

export type HorizonAssessment = {
  isLevel: boolean;
  rollDegrees: number;
  direction: HorizonDirection;
  message: string;
};

export function assessHorizon(rollRadians: number | null | undefined, toleranceDegrees = 3): HorizonAssessment {
  const rollDegrees = Number.isFinite(rollRadians) ? Math.round(((rollRadians ?? 0) * 180) / Math.PI) : 0;
  if (Math.abs(rollDegrees) <= toleranceDegrees) {
    return { isLevel: true, rollDegrees, direction: "level", message: "Phone is level" };
  }
  if (rollDegrees > 0) {
    return {
      isLevel: false,
      rollDegrees,
      direction: "counterclockwise",
      message: "Rotate the phone slightly left",
    };
  }
  return {
    isLevel: false,
    rollDegrees,
    direction: "clockwise",
    message: "Rotate the phone slightly right",
  };
}
