import type { ViewId } from "@align/contracts";
import type { Captures } from "./captureFlow";

export function nextAfterCapture(view: ViewId) {
  return view === "left" ? "awaiting-guidance" as const : "next-view" as const;
}

export function canRequestGuidance(captures: Captures, cloudEnabled: boolean) {
  return cloudEnabled && ["front", "right", "back", "left"].every((view) => Boolean(captures[view as ViewId]));
}
