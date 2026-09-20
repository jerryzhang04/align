import { afterEach, describe, expect, it } from "vitest";
import { audioOutputEnabled, contentParts } from "./omni.js";

const input = {
  requestId: "r1",
  stage: "capture:front",
  measurementsJson: "[]",
  captureNotes: [],
  imageBase64: "IMAGEDATA",
  imageMime: "image/jpeg",
  audioBase64: "AUDIODATA",
  audioFormat: "audio/wav",
};

afterEach(() => {
  delete process.env.OMNI_AUDIO_OUTPUT;
  delete process.env.OMNI_BASE_URL;
});

describe("contentParts", () => {
  it("encodes input_audio.data as the YibuAPI data URI", () => {
    process.env.OMNI_BASE_URL = "https://yibuapi.com/v1";
    const audio = contentParts(input, true).find((p) => p.type === "input_audio") as {
      input_audio: { data: string; format: string };
    };

    expect(audio.input_audio.data).toBe("data:audio/wav;base64,AUDIODATA");
    expect(audio.input_audio.format).toBe("wav");
  });

  it("sends the image as a data: URI, which image_url does require", () => {
    const image = contentParts(input, true).find((p) => p.type === "image_url") as {
      image_url: { url: string };
    };

    expect(image.image_url.url).toBe("data:image/jpeg;base64,IMAGEDATA");
  });

  it("omits audio entirely when audio is not included", () => {
    expect(contentParts(input, false).some((p) => p.type === "input_audio")).toBe(false);
  });

  it("sends raw base64 audio to OpenRouter-style hosts", () => {
    process.env.OMNI_BASE_URL = "https://openrouter.ai/api/v1";
    const audioPart = contentParts(input, true).find((p) => p.type === "input_audio") as {
      input_audio: { data: string; format: string };
    };
    expect(audioPart.input_audio.data).toBe("AUDIODATA");
  });
});

describe("audioOutputEnabled", () => {
  it("defaults to requesting native speech", () => {
    expect(audioOutputEnabled()).toBe(true);
  });

  it("is disabled for providers that cannot emit audio", () => {
    process.env.OMNI_AUDIO_OUTPUT = "false";
    expect(audioOutputEnabled()).toBe(false);
  });
});
