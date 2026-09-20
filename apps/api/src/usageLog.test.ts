import { afterEach, describe, expect, it } from "vitest";
import { buildAuditRecord, keySuffix, normalizeUsage } from "./usageLog.js";
import { encodeAudioData } from "./omni.js";

const audio = { audioBase64: "AUDIOB64", audioFormat: "audio/wav" };

afterEach(() => {
  delete process.env.OMNI_BASE_URL;
});

describe("normalizeUsage", () => {
  it("reads OpenAI-style chat completion usage", () => {
    const u = normalizeUsage({ usage: { prompt_tokens: 1022, completion_tokens: 194, total_tokens: 1216 } });
    expect(u).toMatchObject({ input_tokens: 1022, output_tokens: 194, total_tokens: 1216, usage_reported: true, total_tokens_derived: false });
  });

  it("reads alternate usageMetadata field names", () => {
    const u = normalizeUsage({ usageMetadata: { promptTokenCount: 10, responseTokenCount: 5, totalTokenCount: 15 } });
    expect(u).toMatchObject({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  });

  it("derives a missing total and flags that it was derived", () => {
    const u = normalizeUsage({ usage: { prompt_tokens: 7, completion_tokens: 3 } });
    expect(u.total_tokens).toBe(10);
    expect(u.total_tokens_derived).toBe(true);
  });

  it("treats absent usage as unknown, never as zero", () => {
    const u = normalizeUsage({});
    expect(u.input_tokens).toBeNull();
    expect(u.total_tokens).toBeNull();
    expect(u.usage_reported).toBe(false);
  });
});

describe("key handling", () => {
  it("keeps only the last four characters", () => {
    expect(keySuffix("sk-zYWN3c4WDBdrXYxpFfPAxY0Deyk1BcfYpDYJEs7FfBPFTwIT")).toBe("...TwIT");
  });

  it("marks a missing key rather than inventing one", () => {
    expect(keySuffix("")).toBe("[missing]");
  });

  it("never writes a full key into the error field", () => {
    const record = buildAuditRecord({
      model: "qwen3.5-omni-plus", apiKey: "sk-secret-key-value", endpoint: "https://yibuapi.com/v1/chat/completions",
      purpose: "posture_coaching", transport: "http", ok: false, latencySeconds: 1,
      error: "upstream rejected token sk-secret-key-value",
    });
    expect(record.error).toBe("upstream rejected token [REDACTED]");
    expect(JSON.stringify(record)).not.toContain("sk-secret-key-value");
  });

  it("emits the schema version the organizers' summarizer expects", () => {
    const record = buildAuditRecord({
      model: "m", apiKey: "k", endpoint: "e", purpose: "p", transport: "http", ok: true, latencySeconds: 0.5,
    });
    expect(record.schema_version).toBe("yibu_call_audit_v1");
    expect(record.provider).toBe("yibuapi");
  });
});

describe("encodeAudioData", () => {
  it("sends a data: URI to YibuAPI, matching the organizers' own helper", () => {
    process.env.OMNI_BASE_URL = "https://yibuapi.com/v1";
    expect(encodeAudioData(audio)).toBe("data:audio/wav;base64,AUDIOB64");
  });

});
