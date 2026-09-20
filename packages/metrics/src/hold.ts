export type ViewPhase = "coaching" | "settling" | "collecting" | "accepted" | "retry";

export type HoldConfig = {
  settleMs: number;
  collectMs: number;
  minSamples: number;
  timeoutMs: number;
  maxMotion: number;
};

export const DEFAULT_HOLD: HoldConfig = {
  settleMs: 800,
  collectMs: 2800,
  minSamples: 18,
  timeoutMs: 30_000,
  maxMotion: 0.01,
};

/** Face ID-style dwell: fill only while aligned, empty quickly when they leave. */
export function tickHoldFill(
  progress: number,
  dtMs: number,
  canFill: boolean,
  fillMs = DEFAULT_HOLD.collectMs,
  decayMs = 420,
): number {
  const current = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return current;
  if (canFill) {
    if (!Number.isFinite(fillMs) || fillMs <= 0) return 1;
    return Math.min(1, current + dtMs / fillMs);
  }
  if (!Number.isFinite(decayMs) || decayMs <= 0) return 0;
  return Math.max(0, current - dtMs / decayMs);
}

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

export function holdProgress(
  phase: ViewPhase,
  collectElapsedMs = 0,
  collectMs = DEFAULT_HOLD.collectMs,
): number {
  if (phase === "accepted") return 1;
  if (phase !== "collecting") return 0;
  if (!Number.isFinite(collectMs) || collectMs <= 0) return 0.99;
  if (!Number.isFinite(collectElapsedMs) || collectElapsedMs <= 0) return 0;
  return Math.min(0.99, collectElapsedMs / collectMs);
}
