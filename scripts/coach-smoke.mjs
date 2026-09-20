#!/usr/bin/env node
// End-to-end check of four-view + spoken-goal guidance against the configured provider.
// Boots its own API on an isolated port so it never collides with `npm run iphone`.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readProfile } from "./omni-profile.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.SMOKE_PORT ?? 8799);

function testWav() {
  const path = join(tmpdir(), "align-smoke.wav");
  if (process.platform === "darwin") {
    const say = spawn("say", ["-o", path, "--data-format=LEI16@16000",
      "I feel stiff after working at my desk. What general wellness guidance can you give me from these four views?"], { stdio: "ignore" });
    return new Promise((r) => say.on("exit", (code) => r(code === 0 && existsSync(path) ? { path, real: true } : synth(path))));
  }
  return Promise.resolve(synth(path));
}

// Fallback when `say` is unavailable: a 1s 440Hz tone. Proves the audio modality
// is accepted end to end, but cannot prove the model understood speech.
function synth(path) {
  const rate = 16000, n = rate, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVE", 8);
  head.write("fmt ", 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write("data", 36); head.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([head, data]));
  return { path, real: false };
}

async function waitForHealth(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${url}/v1/health`);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("API did not become healthy");
}

const profile = readProfile(readFileSync(resolve(root, ".env"), "utf8"));
console.log(`profile : ${profile.name}`);
console.log(`model   : ${profile.model}  @ ${profile.baseUrl}`);
if (!profile.key) { console.error("\nOMNI_API_KEY is empty in .env. Nothing to test."); process.exit(1); }

const audio = await testWav();
if (!audio.real) console.log("note    : `say` unavailable, using a tone — checks transport, not comprehension.");

const image = process.env.SMOKE_IMAGE ? resolve(process.env.SMOKE_IMAGE) : resolve(root, "apps/mobile/align-scan-preview.png");
const imageMime = /\.jpe?g$/i.test(image) ? "image/jpeg" : "image/png";
if (!existsSync(image)) { console.error(`Missing test image: ${image}`); process.exit(1); }

const url = `http://127.0.0.1:${PORT}`;
const server = spawn("npx", ["tsx", "apps/api/src/index.ts"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", ALIGN_API_TOKEN: "" },
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });

let exitCode = 0;
try {
  const health = await waitForHealth(url);
  console.log(`health  : mode=${health.providerMode} configured=${health.guidanceConfigured} model=${health.model}\n`);

  // Match the installed iPhone's AAC/M4A recording, not only a desktop WAV.
  const m4aPath = join(tmpdir(), "align-smoke.m4a");
  const converted = spawnSync("afconvert", ["-f", "m4af", "-d", "aac", audio.path, m4aPath]);
  if (converted.status === 0) {
    const turn = new FormData();
    turn.set("meta", JSON.stringify({ requestId: `voice-smoke-${Date.now()}`, scanId: "voice-smoke", stage: "front", measurements: [] }));
    turn.set("image", new Blob([readFileSync(image)], { type: imageMime }), imageMime === "image/jpeg" ? "frame.jpg" : "frame.png");
    turn.set("audio", new Blob([readFileSync(m4aPath)], { type: "audio/mp4" }), "question.m4a");
    const response = await fetch(`${url}/v1/coach/turn`, { method: "POST", body: turn });
    const result = await response.json();
    console.log(`voice   : HTTP ${response.status} ${result.error ?? result.text ?? ""} audio=${Boolean(result.audioBase64)}`);
    console.log(`pose    : ${result.measurements?.length ?? 0} measured findings attached to the voice turn`);
    if (process.env.SMOKE_REQUIRE_POSE === "true" && !result.measurements?.length) throw new Error("Real-photo voice turn produced no measurements");
    if (result.audioBase64) {
      const bytes = Buffer.from(result.audioBase64, "base64");
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("Coach returned audio without a WAV container");
      const speechFile = join(tmpdir(), "align-coach-smoke-output.wav");
      writeFileSync(speechFile, bytes);
      const info = spawnSync("afinfo", [speechFile], { encoding: "utf8" });
      if (process.platform === "darwin" && info.status !== 0) throw new Error("macOS could not decode the returned speech");
      console.log("voice   : native WAV decoder accepted the returned speech");
    }
    if (!response.ok) { exitCode = 1; console.error(serverLog.split("\n").filter((line) => line.includes("omni_turn_failed")).join("\n")); }
  }

  const form = new FormData();
  form.set("meta", JSON.stringify({
    requestId: `smoke-${Date.now()}`, scanId: "smoke",
    views: ["front", "right", "back", "left"],
    measurements: [],
    captureNotes: ["Four-view development smoke test; no verified numeric measurements."],
    locale: "en-CA",
  }));
  for (const view of ["front", "right", "back", "left"]) {
    form.set(view, new Blob([readFileSync(image)], { type: imageMime }), `${view}.${imageMime === "image/jpeg" ? "jpg" : "png"}`);
  }
  if (process.env.SMOKE_PHOTO_ONLY !== "true") form.set("audio", new Blob([readFileSync(audio.path)], { type: "audio/wav" }), "question.wav");

  const t0 = Date.now();
  const res = await fetch(`${url}/v1/guidance/report`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;

  if (!res.ok) {
    console.error(`FAIL  HTTP ${res.status}  error=${body.error ?? "?"}  (${ms}ms)`);
    const why = serverLog.match(/guidance_(?:failed|invalid) \S+ (.*)/);
    if (why) console.error(`      provider said: ${why[1]}`);
    exitCode = 1;
  } else {
    if (process.env.SMOKE_REQUIRE_OMNI === "true" && body.providerMode !== "omni") throw new Error("Report fell back instead of using OMNI");
    console.log(`PASS  HTTP 200  ${ms}ms`);
    console.log(`  summary        : ${(body.summary ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
    console.log(`  provider mode  : ${body.providerMode}`);
    console.log(`  model          : ${body.model}`);
    console.log(`  sources        : ${(body.sources ?? []).map((source) => source.id).join(", ") || "none"}`);
    console.log(`  speechProvider : ${body.speechProvider}`);
    console.log(`  audio          : ${body.audioBase64 ? `${body.audioBase64.length} b64 chars` : "none (captions only)"}`);
    if (body.degraded) {
      console.log("  degraded       : report used a fallback or captions only");
      const codes = serverLog.split("\n").filter((line) => /guidance_fallback_local|guidance_speech_unavailable/.test(line));
      for (const line of codes) console.log(`  diagnostic     : ${line}`);
    }
  }
} catch (error) {
  console.error(`FAIL  ${error.message}`);
  console.error(serverLog.split("\n").slice(-6).join("\n"));
  exitCode = 1;
} finally {
  server.kill();
}
process.exit(exitCode);
