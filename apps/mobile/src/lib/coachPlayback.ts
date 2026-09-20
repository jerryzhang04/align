import { setAudioModeAsync } from "expo-audio";

type CoachPlayer = {
  replace: (source: string) => unknown;
  play: () => void;
  volume?: number;
  muted?: boolean;
  seekTo?: (seconds: number) => Promise<void> | void;
};

export async function prepareCoachPlayback() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    shouldRouteThroughEarpiece: false,
  });
}

export async function playCachedCoachAudio(player: CoachPlayer, uri: string) {
  await prepareCoachPlayback();
  await Promise.resolve(player.replace(uri));
  if (typeof player.volume === "number") player.volume = 1;
  if (typeof player.muted === "boolean") player.muted = false;
  // A replaced item already starts at zero. Seeking before AVPlayer loads it
  // can stall the promise and prevent play() from ever being reached.
  player.play();
}
