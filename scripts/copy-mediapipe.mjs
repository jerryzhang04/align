import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = join(here, "..", "apps", "web", "public", "mediapipe", "wasm");
const candidates = [
  join(here, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm"),
  join(here, "..", "apps", "web", "node_modules", "@mediapipe", "tasks-vision", "wasm"),
];
const source = candidates.find((path) => existsSync(path));

if (!source) {
  console.warn("MediaPipe wasm copy skipped: wasm folder not found");
} else {
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true });
  console.log("Copied MediaPipe wasm to apps/web/public/mediapipe/wasm");
}
