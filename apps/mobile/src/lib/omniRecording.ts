import { AudioQuality, IOSOutputFormat, type RecordingOptions } from "expo-audio";

/** 16 kHz mono WAV — the encoding Qwen Omni / YibuAPI accept most reliably. */
export const OMNI_RECORDING = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  isMeteringEnabled: false,
  android: {
    extension: ".wav",
    outputFormat: "default",
    audioEncoder: "default",
    sampleRate: 16000,
    bitRate: 128000,
  },
  ios: {
    extension: ".wav",
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: 16000,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/wav",
    bitsPerSecond: 128000,
  },
} as RecordingOptions;
