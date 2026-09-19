export type ViewPhase = "coaching" | "settling" | "collecting" | "accepted" | "retry";

export type HoldConfig = {
  settleMs: number;
  collectMs: number;
  minSamples: number;
  timeoutMs: number;
  maxMotion: number;
};

export const DEFAULT_HOLD: HoldConfig = {
  settleMs: 600,
  collectMs: 2000,
  minSamples: 15,
  timeoutMs: 20_000,
  maxMotion: 0.012,
};

export type HoldSnapshot = {
  phase: ViewPhase;
  progress: number;
  accepted: number;
  elapsedMs: number;
};

export function nextHoldPhase(input: {
  now: number;
  viewStartedAt: number;
  qualityOk: boolean;
  motion: number;
  accepted: number;
  collectStartedAt: number | null;
  settleStartedAt: number | null;
  config?: HoldConfig;
}): { phase: ViewPhase; collectStartedAt: number | null; settleStartedAt: number | null; accept: boolean } {
  const config = input.config ?? DEFAULT_HOLD;
  const elapsed = input.now - input.viewStartedAt;
  if (elapsed > config.timeoutMs && input.accepted < config.minSamples) {
    return { phase: "retry", collectStartedAt: null, settleStartedAt: null, accept: false };
  }

  const stable = input.qualityOk && input.motion <= config.maxMotion;
  if (!stable) {
    return { phase: "coaching", collectStartedAt: null, settleStartedAt: null, accept: false };
  }

  const settleStartedAt = input.settleStartedAt ?? input.now;
  if (input.now - settleStartedAt < config.settleMs) {
    return { phase: "settling", collectStartedAt: null, settleStartedAt, accept: false };
  }

  const collectStartedAt = input.collectStartedAt ?? input.now;
  const collectedLongEnough = input.now - collectStartedAt >= config.collectMs;
  if (collectedLongEnough && input.accepted + 1 >= config.minSamples) {
    return { phase: "accepted", collectStartedAt, settleStartedAt, accept: true };
  }
  return { phase: "collecting", collectStartedAt, settleStartedAt, accept: false };
}

export function holdProgress(phase: ViewPhase, accepted: number, minSamples = DEFAULT_HOLD.minSamples): number {
  if (phase === "accepted") return 1;
  if (phase === "collecting") return Math.min(0.95, accepted / minSamples);
  if (phase === "settling") return 0.12;
  return 0;
}
