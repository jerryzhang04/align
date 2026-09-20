import type { ViewId } from "@align/contracts";

export const VIEW_FILL_MS = 2_600;
export const VIEW_HOLD_MS = VIEW_FILL_MS;
export const VIEW_LOCK_MS = 480;
export const VIEW_DECAY_MS = 420;
export const PREVIEW_INTERVAL_MS = 520;
export const LOCAL_FILL_MS = 4_800;

export function bodyGuideVariant(view: ViewId): "front" | "side" {
  return view === "left" || view === "right" ? "side" : "front";
}

export function tickHoldFill(progress: number, dtMs: number, canFill: boolean, fillMs = VIEW_FILL_MS, decayMs = VIEW_DECAY_MS) {
  const current = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return current;
  if (canFill) {
    if (!Number.isFinite(fillMs) || fillMs <= 0) return 1;
    return Math.min(1, current + dtMs / fillMs);
  }
  if (!Number.isFinite(decayMs) || decayMs <= 0) return 0;
  return Math.max(0, current - dtMs / decayMs);
}

export function holdFill(elapsedMs: number, holdMs = VIEW_FILL_MS) {
  return tickHoldFill(0, elapsedMs, true, holdMs);
}

export function holdReadyToCapture(progress: number, alreadyCaptured: boolean, canCapture: boolean) {
  return !alreadyCaptured && canCapture && progress >= 1;
}

export function scanInstruction(view: ViewId, started: boolean, stanceHint = "") {
  if (stanceHint) return stanceHint;
  if (!started) {
    return "Stand on the marker so your head and shoulders match the outline, then start.";
  }
  if (view === "front") return "Match your head and shoulders to the outline. The bar fills only while you hold that stance.";
  if (view === "right") return "Turn so your right side fits the outline. Hold still once it starts filling.";
  if (view === "back") return "Face away and match your head and shoulders. Hold still once it starts filling.";
  return "Turn so your left side fits the outline. Hold still once it starts filling.";
}

export function scanPhaseLabel(view: ViewId, started: boolean, awaitingGuidance: boolean) {
  if (awaitingGuidance) return "FINAL STEP";
  if (!started) return "MATCH THE OUTLINE";
  if (view === "front") return "FRONT";
  if (view === "right") return "RIGHT SIDE";
  if (view === "back") return "BACK";
  return "LEFT SIDE";
}

export function scanHint(started: boolean, awaitingGuidance: boolean, cloudCoachEnabled: boolean) {
  if (awaitingGuidance) {
    return "Tap once to record your goal, then tap again to send it with the four photos.";
  }
  if (started && cloudCoachEnabled) {
    return "The outline fills only while you match it and hold still, like Face ID. Leaving the outline empties it.";
  }
  if (started) {
    return "Hold still in the outline until it fills green, then turn to the next view.";
  }
  if (cloudCoachEnabled) {
    return "Line up your head and shoulders. Four photos, then you can talk to the coach.";
  }
  return "Line up your head and shoulders. Photos stay on this iPhone.";
}

export function scanActionLabel(args: {
  cameraReady: boolean;
  liveStarted: boolean;
  busy: boolean;
  locked: boolean;
  fill: number;
  aligned?: boolean;
}) {
  if (args.liveStarted && args.locked) return "Photo saved";
  if (args.liveStarted && args.busy) return "Capturing…";
  if (args.liveStarted && args.aligned === false && args.fill <= 0) return "Match the outline";
  if (args.liveStarted) return `${Math.round(Math.max(0, Math.min(1, args.fill)) * 100)}% filled`;
  if (args.cameraReady) return "Start scan";
  return "Starting camera…";
}
