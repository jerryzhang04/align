#!/usr/bin/env node
// List the model IDs the configured provider actually exposes.
// Run this FIRST with a new credential: a wrong model ID fails the same way a
// wrong key does, and the sponsor gateway's catalogue is not guaranteed to
// match any model name written down in advance.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readProfile } from "./omni-profile.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profile = readProfile(readFileSync(resolve(root, ".env"), "utf8"));
const filter = (process.argv[2] ?? "").toLowerCase();

console.log(`profile : ${profile.name}`);
console.log(`base    : ${profile.baseUrl}`);
if (!profile.key) { console.error("\nOMNI_API_KEY is empty in .env."); process.exit(1); }

const response = await fetch(`${profile.baseUrl}/models`, {
  headers: { Authorization: `Bearer ${profile.key}` },
  signal: AbortSignal.timeout(20_000),
}).catch((error) => { console.error(`\nRequest failed: ${error.message}`); process.exit(1); });

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`\nHTTP ${response.status}: ${payload?.error?.message ?? JSON.stringify(payload).slice(0, 200)}`);
  if (response.status === 401) {
    console.error("\nThe key is not valid for this base URL.");
    console.error("Each profile needs a credential issued for its own endpoint.");
  }
  process.exit(1);
}

const ids = (payload.data ?? []).map((m) => m.id).filter(Boolean).sort();
const shown = filter ? ids.filter((id) => id.toLowerCase().includes(filter)) : ids;

console.log(`\n${ids.length} model(s) available${filter ? `, ${shown.length} matching "${filter}"` : ""}:\n`);
for (const id of shown) console.log(`  ${id}`);

if (!filter) {
  const omni = ids.filter((id) => /omni|audio|qwen/i.test(id));
  if (omni.length) {
    console.log(`\nLikely multimodal candidates:\n`);
    for (const id of omni) console.log(`  ${id}`);
  }
  console.log(`\nSet one with:  npm run omni:use -- omni <key>   (then edit OMNI_MODEL)`);
  console.log(`Verify with :  npm run omni:smoke`);
}
