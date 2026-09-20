import { expect, it } from "vitest";
import { independentStills, refineStillPose } from "./stillPose.js";

it("serializes and resets a stateful detector between unrelated photos", async () => {
  let crop = 0;
  let running = 0;
  const estimate = independentStills({
    reset: () => { crop = 0; },
    estimate: async (value: number) => {
      running += 1;
      expect(running).toBe(1);
      const initial = crop;
      await new Promise((resolve) => setTimeout(resolve, 1));
      crop = value;
      running -= 1;
      return initial;
    },
  });
  expect(await Promise.all([estimate(10), estimate(20)])).toEqual([0, 0]);
});

it("releases the detector after a failed photo", async () => {
  const estimate = independentStills({ reset() {}, estimate: async (fail: boolean) => {
    if (fail) throw new Error("bad photo");
    return "next photo";
  } });
  await expect(estimate(true)).rejects.toThrow("bad photo");
  await expect(estimate(false)).resolves.toBe("next photo");
});

it("uses the body crop from the first pass to refine the same still", async () => {
  let cropFound = false;
  const result = await refineStillPose(async () => {
    const pose = cropFound ? [{ score: 0.9 }] : [{ score: 0.4 }];
    cropFound = true;
    return pose;
  });
  expect(result).toEqual([{ score: 0.9 }]);
});
