import type { ViewId } from "@align/contracts";

export type CaptureView = {
  id: ViewId;
  label: string;
  instruction: string;
};

export const CAPTURE_VIEWS: readonly CaptureView[] = [
  { id: "front", label: "Front", instruction: "Face the phone with your feet on the marker." },
  { id: "right", label: "Right", instruction: "Turn a quarter turn so your right side faces the phone." },
  { id: "back", label: "Back", instruction: "Turn another quarter turn and face away from the phone." },
  { id: "left", label: "Left", instruction: "Turn once more so your left side faces the phone." },
] as const;

export type CaptureStep = ViewId | "complete";
export type Captures = Partial<Record<ViewId, string>>;

export function advanceCapture(current: ViewId): CaptureStep {
  const index = CAPTURE_VIEWS.findIndex((view) => view.id === current);
  return CAPTURE_VIEWS[index + 1]?.id ?? "complete";
}

export function captureProgress(captures: Captures) {
  return {
    accepted: CAPTURE_VIEWS.filter((view) => Boolean(captures[view.id])).length,
    total: CAPTURE_VIEWS.length,
  };
}
