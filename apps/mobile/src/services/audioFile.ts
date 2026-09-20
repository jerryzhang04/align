import { File, Paths } from "expo-file-system";

function decodeBase64(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function cacheCoachAudio(base64: string, mime = "audio/wav") {
  const extension = mime.includes("wav") || mime.includes("pcm") ? "wav" : mime.includes("mp4") || mime.includes("m4a") ? "m4a" : "mp3";
  const file = new File(Paths.cache, `align-coach-${Date.now()}.${extension}`);
  file.create({ overwrite: true, intermediates: true });
  file.write(decodeBase64(base64));
  return file.uri;
}
