import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { patchBundleScript } = require("./with-space-safe-ios-build.cjs");

const unsafe = `before
\`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"\`
after`;

test("patchBundleScript executes a React Native script path containing spaces safely", () => {
  const patched = patchBundleScript(unsafe);
  assert.match(patched, /REACT_NATIVE_XCODE_SCRIPT=/);
  assert.match(patched, /"\$REACT_NATIVE_XCODE_SCRIPT"/);
  assert.doesNotMatch(patched, /\n`"\$NODE_BINARY"/);
});

test("patchBundleScript is idempotent", () => {
  const patched = patchBundleScript(unsafe);
  assert.equal(patchBundleScript(patched), patched);
});

test("patchBundleScript emits valid shell syntax", () => {
  const result = spawnSync("bash", ["-n"], {
    input: patchBundleScript(unsafe),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("patchBundleScript fails loudly if Expo changes the generated phase", () => {
  assert.throws(() => patchBundleScript("different script"), /react_native_bundle_phase_changed/);
});
