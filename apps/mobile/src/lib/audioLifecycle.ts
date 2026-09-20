type PausableAudio = {
  pause: () => void;
};

export function pauseAudioSafely(player: PausableAudio): void {
  try {
    player.pause();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Unable to find the native shared object") || message.includes("NotFoundException")) return;
    throw error;
  }
}
