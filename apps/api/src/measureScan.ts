import { VIEWS, type Measurement, type ViewId } from "@align/contracts";
import { aggregateMeasurements, assessFrame, type PoseFrame } from "@align/metrics";

export type PoseImage = {
  view: ViewId;
  bytes: Uint8Array;
};

export type ScanPoseResult = {
  measurements: Measurement[];
  source: "movenet-lightning" | "none";
  viewsWithPose: ViewId[];
};

const STILL_LIMITATION = "Projected geometry from phone stills / short live samples, not millimetres or a clinical hold.";

async function defaultEstimate(bytes: Uint8Array) {
  const { estimatePoseFromJpeg } = await import("./poseEstimate.js");
  return estimatePoseFromJpeg(bytes);
}

export async function measurePoseImages(
  images: PoseImage[],
  estimate: (bytes: Uint8Array) => Promise<PoseFrame | null> = defaultEstimate,
): Promise<ScanPoseResult> {
  const framesByView: Record<ViewId, PoseFrame[]> = { front: [], right: [], back: [], left: [] };
  for (const image of images) {
    const frame = await estimate(image.bytes);
    if (frame) framesByView[image.view].push(frame);
  }

  const viewsWithPose = VIEWS.filter((view) => framesByView[view].length > 0);
  const measurements = viewsWithPose.flatMap((view) => {
    const framed = framesByView[view];
    const minSamplesForUsable = framed.some((frame) => assessFrame(frame, view).ok) ? Math.min(3, framed.length) : 8;
    return aggregateMeasurements(framed, view, {
      minSamplesForUsable: Math.max(1, minSamplesForUsable),
      extraLimitations: [STILL_LIMITATION],
    });
  });

  return {
    measurements,
    source: viewsWithPose.length ? "movenet-lightning" : "none",
    viewsWithPose,
  };
}
