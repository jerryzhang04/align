import type { ViewId } from "@align/contracts";

export const LIVE_SCAN_DURATION_MS = 12_000;
const PHASE_DURATION_MS = LIVE_SCAN_DURATION_MS / 4;

const phases: Array<{ view: ViewId; instruction: string }> = [
  { view: "front", instruction: "Face the camera and hold still for a moment." },
  { view: "right", instruction: "Slowly turn so your right side faces the camera." },
  { view: "back", instruction: "Continue turning until your back faces the camera." },
  { view: "left", instruction: "Complete the turn with your left side facing the camera." },
];

export function liveScanPhase(elapsedMs: number) {
  const safeElapsed = Math.max(0, elapsedMs);
  const index = Math.min(phases.length - 1, Math.floor(safeElapsed / PHASE_DURATION_MS));
  return {
    ...phases[index]!,
    index,
    complete: safeElapsed >= LIVE_SCAN_DURATION_MS,
    progress: Math.min(1, safeElapsed / LIVE_SCAN_DURATION_MS),
  };
}

/** Advance at most one phase, and hold until a real image has been retained. */
export function advanceLiveScan(elapsedMs: number, deltaMs: number, captured: ReadonlySet<ViewId>) {
  const phase = liveScanPhase(elapsedMs);
  if (phase.complete) return LIVE_SCAN_DURATION_MS;
  const boundary = (phase.index + 1) * PHASE_DURATION_MS;
  return Math.min(elapsedMs + Math.max(0, deltaMs), boundary - (captured.has(phase.view) ? 0 : 1));
}
