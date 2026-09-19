import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const originalEnvironment = `  env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT']} " : ""`;
const patchedEnvironment = `  env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT'].dump} " : ""`;
const originalScript = `    :script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",`;
const patchedScript = `    :script => "#{env_vars}bash -l -c '\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"'",`;

export function patchPodspecText(text) {
  if (text.includes(patchedEnvironment) && text.includes(patchedScript)) return text;
  if (!text.includes(originalEnvironment) || !text.includes(originalScript)) {
    throw new Error("expo_constants_patch_source_changed");
  }

  return text
    .replace(originalEnvironment, patchedEnvironment)
    .replace(originalScript, patchedScript);
}

function patchInstalledPodspec() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const podspec = resolve(
    repoRoot,
    "apps/mobile/node_modules/expo-constants/ios/EXConstants.podspec",
  );
  const before = readFileSync(podspec, "utf8");
  const after = patchPodspecText(before);
  if (after !== before) {
    writeFileSync(podspec, after);
    console.log("Patched expo-constants for workspace paths containing spaces");
  }
}

const invokedUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedUrl) patchInstalledPodspec();
