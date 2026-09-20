import test from "node:test";
import assert from "node:assert/strict";
import { PROFILES, applyProfile, readProfile } from "./omni-profile.mjs";

const base = "OMNI_API_KEY=old-key\nOMNI_BASE_URL=https://example.test/v1\nOMNI_MODEL=other-model\nOMNI_AUDIO_OUTPUT=false\nPORT=8788\n";

test("switching to the omni profile rewrites every provider field together", () => {
  const next = applyProfile(base, PROFILES.omni, "sk-sponsor-key");
  const read = readProfile(next);
  assert.equal(read.name, "omni");
  assert.equal(read.baseUrl, "https://yibuapi.com/v1");
  assert.equal(read.model, "qwen3.5-omni-plus");
  assert.equal(read.audioOutput, "true");
  assert.equal(read.key, "sk-sponsor-key");
});

test("omitting the key keeps the existing one", () => {
  assert.equal(readProfile(applyProfile(base, PROFILES.omni)).key, "old-key");
});

test("unrelated settings survive a switch", () => {
  assert.match(applyProfile(base, PROFILES.omni, "k"), /^PORT=8788$/m);
});

test("a missing key is appended rather than dropped", () => {
  const next = applyProfile("PORT=8788\n", PROFILES.omni, "sponsor-key");
  assert.equal(readProfile(next).key, "sponsor-key");
  assert.equal(readProfile(next).model, "qwen3.5-omni-plus");
});

test("an unrecognised base URL reads as a custom profile", () => {
  assert.equal(readProfile("OMNI_BASE_URL=https://example.test/v1\n").name, "custom");
});
