export function recordingUpload(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.includes(".wav")) return { name: "question.wav", type: "audio/wav" as const };
  if (lower.includes(".m4a") || lower.includes(".mp4") || lower.includes(".aac")) {
    return { name: "question.m4a", type: "audio/mp4" as const };
  }
  return { name: "question.wav", type: "audio/wav" as const };
}
