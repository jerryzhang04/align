import { expect, it, vi } from "vitest";
vi.mock("expo-audio", () => ({ setAudioModeAsync: async () => undefined }));
import { playCachedCoachAudio } from "./coachPlayback";

it("starts a new source without waiting for a seek on an unloaded native item", async () => {
  let playing = false;
  const player = {
    replace: () => undefined,
    play: () => { playing = true; },
    seekTo: () => { throw new Error("item is not ready to seek"); },
  };
  await playCachedCoachAudio(player, "file:///reply.wav");
  expect(playing).toBe(true);
});
