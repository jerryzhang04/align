import { imageKeypointsToPoseFrame, type PoseFrame } from "@align/metrics";
import * as jpegJs from "jpeg-js";
import { independentStills, refineStillPose } from "./stillPose.js";

type JpegDecoded = { data: Uint8Array; width: number; height: number };

function decodeJpeg(bytes: Uint8Array): JpegDecoded {
  const mod = jpegJs as unknown as {
    decode?: (data: Buffer, options?: { useTArray?: boolean; formatAsRGBA?: boolean }) => JpegDecoded;
    default?: { decode: (data: Buffer, options?: { useTArray?: boolean; formatAsRGBA?: boolean }) => JpegDecoded };
  };
  const decode = mod.decode ?? mod.default?.decode;
  if (!decode) throw new Error("jpeg_decoder_unavailable");
  return decode(Buffer.from(bytes), { useTArray: true, formatAsRGBA: true });
}

const MAX_POSE_EDGE = 640;

type PoseDetector = {
  estimate: (rgb: Uint8Array, width: number, height: number, refine: boolean) => Promise<Array<{ x: number; y: number; score?: number; name?: string }>>;
};

let detectorPromise: Promise<PoseDetector> | null = null;

function downscaleRgba(data: Uint8Array, width: number, height: number, maxEdge = MAX_POSE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  if (nextWidth === width && nextHeight === height) return { data, width, height };
  const next = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor((y * height) / nextHeight));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x * width) / nextWidth));
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * nextWidth + x) * 4;
      next[to] = data[from]!;
      next[to + 1] = data[from + 1]!;
      next[to + 2] = data[from + 2]!;
      next[to + 3] = data[from + 3]!;
    }
  }
  return { data: next, width: nextWidth, height: nextHeight };
}

function rgbaToRgb(data: Uint8Array, width: number, height: number) {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]!;
    rgb[j + 1] = data[i + 1]!;
    rgb[j + 2] = data[i + 2]!;
  }
  return rgb;
}

async function loadDetector(): Promise<PoseDetector> {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-cpu");
  await tf.setBackend("cpu");
  await tf.ready();
  const poseDetection = await import("@tensorflow-models/pose-detection");
  const created = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: false,
  });
  return {
    estimate: independentStills({
      reset: () => created.reset(),
      async estimate(rgb: Uint8Array, width: number, height: number, refine: boolean) {
        const tensor = tf.tensor3d(rgb, [height, width, 3]);
        try {
          const estimate = () => created.estimatePoses(tensor, { flipHorizontal: false });
          const poses = await (refine ? refineStillPose(estimate) : estimate());
          return poses[0]?.keypoints ?? [];
        } finally {
          tensor.dispose();
        }
      },
    }),
  };
}

function getDetector() {
  detectorPromise ??= loadDetector().catch((error: unknown) => {
    detectorPromise = null;
    throw error;
  });
  return detectorPromise;
}

/** MoveNet Lightning pose on a JPEG buffer. Returns null if the image is not a usable body crop. */
export async function estimatePoseFromJpeg(bytes: Uint8Array, options: { preview?: boolean } = {}): Promise<PoseFrame | null> {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let decoded: { data: Uint8Array; width: number; height: number };
  try {
    decoded = decodeJpeg(bytes);
  } catch {
    return null;
  }
  if (!decoded.width || !decoded.height || decoded.data.length < 16) return null;

  const scaled = downscaleRgba(decoded.data, decoded.width, decoded.height, options.preview ? 384 : MAX_POSE_EDGE);
  let detector: PoseDetector;
  try {
    detector = await getDetector();
  } catch (error) {
    console.warn("pose_detector_unavailable", error instanceof Error ? error.message : error);
    throw new Error("pose_detector_unavailable");
  }

  try {
    const keypoints = await detector.estimate(rgbaToRgb(scaled.data, scaled.width, scaled.height), scaled.width, scaled.height, true);
    if (!keypoints.length) return null;
    return imageKeypointsToPoseFrame(keypoints, scaled.width, scaled.height);
  } catch (error) {
    console.warn("pose_estimate_failed", error instanceof Error ? error.message : error);
    return null;
  }
}
