export function captureJpeg(video: HTMLVideoElement, maxWidth = 640, quality = 0.72): Promise<Blob> {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const width = Math.max(1, Math.round((video.videoWidth || maxWidth) * scale));
  const height = Math.max(1, Math.round((video.videoHeight || 480) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("no_canvas"));
  ctx.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("jpeg_failed"));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}
