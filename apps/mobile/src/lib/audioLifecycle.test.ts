import { describe, expect, it } from "vitest";
import { pauseAudioSafely } from "./audioLifecycle";

describe("pauseAudioSafely", () => {
  it("ignores Expo's released shared-object error", () => {
    const releasedPlayer = {
      pause() {
        throw new Error("NotFoundException: Unable to find the native shared object associated with given JavaScript object");
      },
    };

    expect(() => pauseAudioSafely(releasedPlayer)).not.toThrow();
  });

  it("does not hide unrelated audio failures", () => {
    const brokenPlayer = {
      pause() {
        throw new Error("speaker unavailable");
      },
    };

    expect(() => pauseAudioSafely(brokenPlayer)).toThrow("speaker unavailable");
  });
});
