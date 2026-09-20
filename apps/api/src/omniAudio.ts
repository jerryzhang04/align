/** Qwen streams 24 kHz, mono, signed 16-bit PCM even with audio.format=wav.
 * https://www.alibabacloud.com/help/en/model-studio/qwen-omni
 * Native players require the RIFF container, not just a .wav filename.
 */
export function playableOmniAudio(base64: string): string {
  const pcm = Buffer.from(base64, "base64");
  if (pcm.toString("ascii", 0, 4) === "RIFF" && pcm.toString("ascii", 8, 12) === "WAVE") return base64;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}
