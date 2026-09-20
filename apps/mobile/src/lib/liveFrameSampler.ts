export const DEFAULT_LIVE_FRAME_INTERVAL_MS = 750;

export type LiveFrameSamplerOptions = {
  intervalMs?: number;
};

export type LiveFrameSamplerState = {
  stopped: boolean;
  inFlight: boolean;
  lastCaptureStartedAt: number | null;
};

export type LiveFrameSampler = {
  /** Returns whether a capture could start at the supplied timestamp. */
  shouldSample(timestampMs: number, externalCaptureInFlight?: boolean): boolean;
  /** Claims the next capture slot, returning false when it is not available. */
  tryStart(timestampMs: number, externalCaptureInFlight?: boolean): boolean;
  markCaptureComplete(): void;
  markCaptureFailure(): void;
  stop(): void;
  restart(): void;
  reset(): void;
  isInFlight(): boolean;
  isStopped(): boolean;
  getState(): LiveFrameSamplerState;
};

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs)) {
    throw new RangeError("timestampMs must be a finite number");
  }
}

export function createLiveFrameSampler(options: LiveFrameSamplerOptions = {}): LiveFrameSampler {
  const intervalMs = options.intervalMs ?? DEFAULT_LIVE_FRAME_INTERVAL_MS;

  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new RangeError("intervalMs must be a non-negative finite number");
  }

  let stopped = false;
  let inFlight = false;
  let lastCaptureStartedAt: number | null = null;

  const shouldSample = (timestampMs: number, externalCaptureInFlight = false): boolean => {
    assertTimestamp(timestampMs);

    if (stopped || inFlight || externalCaptureInFlight) {
      return false;
    }

    return (
      lastCaptureStartedAt === null ||
      timestampMs >= lastCaptureStartedAt + intervalMs
    );
  };

  const tryStart = (timestampMs: number, externalCaptureInFlight = false): boolean => {
    if (!shouldSample(timestampMs, externalCaptureInFlight)) {
      return false;
    }

    lastCaptureStartedAt = timestampMs;
    inFlight = true;
    return true;
  };

  const releaseCapture = (): void => {
    inFlight = false;
  };

  const reset = (): void => {
    stopped = false;
    inFlight = false;
    lastCaptureStartedAt = null;
  };

  return {
    shouldSample,
    tryStart,
    markCaptureComplete: releaseCapture,
    markCaptureFailure: releaseCapture,
    stop: () => {
      stopped = true;
    },
    restart: reset,
    reset,
    isInFlight: () => inFlight,
    isStopped: () => stopped,
    getState: () => ({ stopped, inFlight, lastCaptureStartedAt }),
  };
}
