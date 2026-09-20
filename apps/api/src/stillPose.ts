/** First pass locates the body; second pass uses that crop on the same photo. */
export async function refineStillPose<Result>(estimate: () => Promise<Result[]>): Promise<Result[]> {
  const initial = await estimate();
  if (!initial.length) return initial;
  const refined = await estimate();
  return refined.length ? refined : initial;
}

/** MoveNet keeps a crop and filters between frames. Server photos are independent. */
export function independentStills<Args extends unknown[], Result>(detector: {
  reset(): void;
  estimate(...args: Args): Promise<Result>;
}) {
  let tail: Promise<unknown> = Promise.resolve();
  return (...args: Args): Promise<Result> => {
    const result = tail.then(() => {
      detector.reset();
      return detector.estimate(...args);
    });
    tail = result.catch(() => undefined);
    return result;
  };
}
