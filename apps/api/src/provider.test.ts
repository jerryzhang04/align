import { describe, expect, it } from "vitest";
import { resolveProviderConfig } from "./provider.js";

describe("resolveProviderConfig", () => {
  it("refuses to configure a non-Yibu provider", () => {
    expect(resolveProviderConfig({
      OMNI_API_KEY: "key",
      OMNI_BASE_URL: "https://example.test/v1",
      OMNI_MODEL: "other-model",
      OMNI_AUDIO_OUTPUT: "false",
    })).toMatchObject({ configured: false, mode: "unconfigured", provider: null, nativeAudioExpected: false });
  });

  it("labels the approved Yibu model as OMNI", () => {
    expect(resolveProviderConfig({
      OMNI_API_KEY: "key",
      OMNI_BASE_URL: "https://yibuapi.com/v1",
      OMNI_MODEL: "qwen3.5-omni-plus",
      OMNI_AUDIO_OUTPUT: "true",
    })).toMatchObject({ configured: true, mode: "omni", provider: "yibu", nativeAudioExpected: true });
  });

  it("does not report an empty key as configured", () => {
    expect(resolveProviderConfig({ OMNI_API_KEY: "" }).mode).toBe("unconfigured");
  });
});
