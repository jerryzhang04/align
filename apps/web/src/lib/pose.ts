import type { LandmarkSample, PoseFrame } from "@align/metrics";

type PoseLandmarkerLike = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number; presence?: number }>> };
  close?: () => void;
};

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<PoseLandmarkerLike> {
  const vision = await import("@mediapipe/tasks-vision");
  const wasmLocal = "/mediapipe/wasm";
  const wasmCdn = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
  let fileset;
  try {
    fileset = await vision.FilesetResolver.forVisionTasks(wasmLocal);
  } catch {
    fileset = await vision.FilesetResolver.forVisionTasks(wasmCdn);
  }
  return vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function getPoseLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker("GPU").catch(() => createLandmarker("CPU"));
  }
  return landmarkerPromise;
}

export function detectPose(landmarker: PoseLandmarkerLike, video: HTMLVideoElement, timestamp: number): PoseFrame | null {
  const result = landmarker.detectForVideo(video, timestamp);
  const pose = result.landmarks?.[0];
  if (!pose) return null;
  const landmarks: LandmarkSample[] = pose.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility,
    presence: point.presence,
  }));
  return {
    width: video.videoWidth || 1,
    height: video.videoHeight || 1,
    landmarks,
  };
}
