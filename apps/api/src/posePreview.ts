import { DEFAULT_HOLD, fitBodyGuide, motionScore, type PoseFrame } from "@align/metrics";
import type { ViewId } from "@align/contracts";

export type StancePreview = {
  aligned: boolean;
  still: boolean;
  pose: boolean;
  issues: Array<{ code: string; message: string }>;
  frame: PoseFrame | null;
};

const STILL_MESSAGE = { code: "moving", message: "Hold still in the outline." };

export async function previewStanceFromJpeg(
  bytes: Uint8Array,
  view: ViewId,
  previous: PoseFrame | null,
  estimate: (bytes: Uint8Array) => Promise<PoseFrame | null>,
): Promise<StancePreview> {
  const frame = await estimate(bytes);
  if (!frame) {
    return {
      aligned: false,
      still: false,
      pose: false,
      issues: [{ code: "no_pose", message: "Step into the outline so your whole body is visible." }],
      frame: null,
    };
  }

  const fit = fitBodyGuide(frame, view);
  const motion = motionScore(previous, frame);
  const still = !previous || motion <= DEFAULT_HOLD.maxMotion;
  const issues = still ? fit.issues : [...fit.issues, STILL_MESSAGE];
  return {
    aligned: fit.ok && still,
    still,
    pose: true,
    issues: issues.filter((issue, index) => issues.findIndex((item) => item.code === issue.code) === index),
    frame,
  };
}
