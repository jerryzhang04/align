import type { ViewId } from "@align/contracts";

export const VIEW_HOLD_MS = 2_800;
export const VIEW_LOCK_MS = 480;

export function bodyGuideVariant(view: ViewId): "front" | "side" {
  return view === "left" || view === "right" ? "side" : "front";
}

export function holdFill(elapsedMs: number, holdMs = VIEW_HOLD_MS) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  if (!Number.isFinite(holdMs) || holdMs <= 0) return 1;
  return Math.min(1, elapsedMs / holdMs);
}

export function holdReadyToCapture(elapsedMs: number, alreadyCaptured: boolean, holdMs = VIEW_HOLD_MS) {
  return !alreadyCaptured && holdFill(elapsedMs, holdMs) >= 1;
}

export function scanInstruction(view: ViewId, started: boolean) {
  if (!started) {
    return "Stand on the marker so your head and shoulders match the outline, then start.";
  }
  if (view === "front") return "Match your head and shoulders to the outline. Hold still until it fills green.";
  if (view === "right") return "Turn so your right side fits the outline. Hold still until it fills green.";
  if (view === "back") return "Face away and match your head and shoulders. Hold still until it fills green.";
  return "Turn so your left side fits the outline. Hold still until it fills green.";
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
  if (started) {
    return "Hold still until the outline fills green. After the photo, turn to the next outline.";
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
}) {
  if (args.liveStarted && args.locked) return "Photo saved";
  if (args.liveStarted && args.busy) return "Capturing…";
  if (args.liveStarted) return `${Math.round(Math.max(0, Math.min(1, args.fill)) * 100)}% filled`;
  if (args.cameraReady) return "Start scan";
  return "Starting camera…";
}
