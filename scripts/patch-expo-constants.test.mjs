import test from "node:test";
import assert from "node:assert/strict";
import { patchPodspecText } from "./patch-expo-constants.mjs";

const original = `  env_vars = ENV['PROJECT_ROOT'] ? "PROJECT_ROOT=#{ENV['PROJECT_ROOT']} " : ""
    :script => "bash -l -c \\"#{env_vars}$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"",`;

test("patchPodspecText preserves spaces in the project and script paths", () => {
  const patched = patchPodspecText(original);

  assert.match(patched, /PROJECT_ROOT=#\{ENV\['PROJECT_ROOT'\]\.dump\}/);
  assert.match(
    patched,
    /:script => "#\{env_vars\}bash -l -c '\\"\$PODS_TARGET_SRCROOT\/\.\.\/scripts\/get-app-config-ios\.sh\\"'",/,
  );
});

test("patchPodspecText is idempotent", () => {
  const patched = patchPodspecText(original);
  assert.equal(patchPodspecText(patched), patched);
});

test("patchPodspecText fails loudly if Expo changes the source", () => {
  assert.throws(() => patchPodspecText("different podspec"), /expo_constants_patch_source_changed/);
});
