import type { ViewId } from "@align/contracts";

/** Progress comes from distinct fresh camera observations, never from a wall-clock hold. */
export function createPreviewGate() {
  let view: ViewId | undefined;
  let sampledAt = -1;
  let consecutive = 0;
  const maxAgeMs = 4_000;
  const progress = (nextView: ViewId, now: number) =>
    nextView === view && now >= sampledAt && now - sampledAt <= maxAgeMs ? Math.min(1, consecutive / 3) : 0;
  return {
    observe(nextView: ViewId, photoTime: number, valid: boolean, receivedAt = photoTime) {
      if (nextView === view && photoTime <= sampledAt) return;
      if (nextView !== view || photoTime - sampledAt > maxAgeMs || !valid) consecutive = 0;
      view = nextView;
      sampledAt = photoTime;
      if (receivedAt < photoTime || receivedAt - photoTime > maxAgeMs) consecutive = 0;
      else if (valid) consecutive += 1;
    },
    progress,
    ready(nextView: ViewId, now: number) { return progress(nextView, now) === 1; },
    reset() { view = undefined; consecutive = 0; sampledAt = -1; },
  };
}
