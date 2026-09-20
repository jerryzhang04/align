#!/usr/bin/env node
// Apply the sponsor OMNI configuration without exposing the credential.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PROFILES = {
  omni: {
    label: "Huawei OMNI via YibuAPI (sponsor track)",
    OMNI_BASE_URL: "https://yibuapi.com/v1",
    OMNI_MODEL: "qwen3.5-omni-plus",
    OMNI_AUDIO_OUTPUT: "true",
    keyHint: "sk-... issued for yibuapi.com",
    note: "Native audio expected. This is the only profile valid for the Huawei track.",
  },
};

export function applyProfile(envText, profile, apiKey) {
  const keys = { ...profile };
  delete keys.label;
  delete keys.keyHint;
  delete keys.note;
  if (apiKey) keys.OMNI_API_KEY = apiKey;

  let text = envText;
  for (const [key, value] of Object.entries(keys)) {
    const line = `${key}=${value}`;
    text = new RegExp(`^${key}=.*$`, "m").test(text)
      ? text.replace(new RegExp(`^${key}=.*$`, "m"), line)
      : `${text.replace(/\n*$/, "\n")}${line}\n`;
  }
  return text;
}

export function readProfile(envText) {
  const get = (key) => envText.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  const baseUrl = get("OMNI_BASE_URL");
  const name = Object.keys(PROFILES).find((k) => PROFILES[k].OMNI_BASE_URL === baseUrl) ?? "custom";
  return { name, baseUrl, model: get("OMNI_MODEL"), audioOutput: get("OMNI_AUDIO_OUTPUT"), key: get("OMNI_API_KEY") };
}

const mask = (k) => (k ? `${k.slice(0, 11)}…${k.slice(-4)} (${k.length} chars)` : "(unset)");

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const file = resolve(root, ".env");
  if (!existsSync(file)) {
    console.error("No .env found. Copy .env.example to .env first.");
    process.exit(1);
  }

  const [name, apiKey] = process.argv.slice(2);
  const text = readFileSync(file, "utf8");

  if (!name) {
    const current = readProfile(text);
    console.log(`Current profile : ${current.name}`);
    console.log(`  base URL      : ${current.baseUrl}`);
    console.log(`  model         : ${current.model}`);
    console.log(`  audio output  : ${current.audioOutput || "true"}`);
    console.log(`  key           : ${mask(current.key)}`);
    console.log(`\nSwitch with:  npm run omni:use -- <${Object.keys(PROFILES).join("|")}> [apiKey]`);
    for (const [k, p] of Object.entries(PROFILES)) console.log(`  ${k.padEnd(11)} ${p.label}`);
    return;
  }

  const profile = PROFILES[name];
  if (!profile) {
    console.error(`Unknown profile "${name}". Use one of: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }

  writeFileSync(file, applyProfile(text, profile, apiKey));
  const now = readProfile(readFileSync(file, "utf8"));
  console.log(`Switched to "${name}" — ${profile.label}`);
  console.log(`  base URL      : ${now.baseUrl}`);
  console.log(`  model         : ${now.model}`);
  console.log(`  audio output  : ${now.audioOutput}`);
  console.log(`  key           : ${mask(now.key)}`);
  if (!apiKey) console.log(`\n  Key unchanged. This profile expects ${profile.keyHint}`);
  console.log(`\n  ${profile.note}`);
  console.log(`  Verify with:  npm run omni:smoke`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
