import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  createApiCommand,
  createLaunchEnvironments,
  createMobileCommandArgs,
  selectLanAddress,
} from "./iphone-utils.mjs";

test("selectLanAddress prefers a private Wi-Fi IPv4 address", () => {
  const address = selectLanAddress({
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    utun3: [{ address: "100.64.0.2", family: "IPv4", internal: false }],
    en0: [{ address: "192.168.1.44", family: "IPv4", internal: false }],
  });
  assert.equal(address, "192.168.1.44");
});

test("selectLanAddress falls back to another private adapter", () => {
  const address = selectLanAddress({
    en7: [{ address: "10.0.0.22", family: 4, internal: false }],
    en0: [{ address: "169.254.1.4", family: "IPv4", internal: false }],
  });
  assert.equal(address, "10.0.0.22");
});

test("selectLanAddress explains when no phone-reachable address exists", () => {
  assert.throws(
    () => selectLanAddress({ lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }] }),
    /no_lan_ipv4_address/,
  );
});

test("createLaunchEnvironments shares one ephemeral token without exposing provider keys to Expo", () => {
  const { apiEnv, mobileEnv, apiUrl } = createLaunchEnvironments(
    {
      PATH: "/usr/bin",
      OMNI_API_KEY: "server-only-omni",
    },
    { address: "192.168.1.44", port: 8788, token: "temporary-token" },
  );

  assert.equal(apiEnv.HOST, "0.0.0.0");
  assert.equal(apiEnv.ALIGN_API_TOKEN, "temporary-token");
  assert.equal(mobileEnv.EXPO_PUBLIC_ALIGN_API_URL, "http://192.168.1.44:8788");
  assert.equal(mobileEnv.EXPO_PUBLIC_ALIGN_API_TOKEN, "temporary-token");
  assert.equal(apiUrl, "http://192.168.1.44:8788");
  assert.equal("OMNI_API_KEY" in mobileEnv, false);
});

test("createMobileCommandArgs selects Expo Go and the development client explicitly", () => {
  assert.deepEqual(createMobileCommandArgs(false), [
    "run", "start", "--workspace=@align/mobile", "--", "--lan", "--go",
  ]);
  assert.deepEqual(createMobileCommandArgs(true), [
    "run", "start", "--workspace=@align/mobile", "--", "--lan", "--dev-client",
  ]);
});

test("createApiCommand avoids an npm lifecycle wrapper so Ctrl+C stays quiet", () => {
  assert.deepEqual(createApiCommand("/repo"), {
    command: resolve("/repo", "node_modules/.bin/tsx"),
    args: ["watch", "src/index.ts"],
    cwd: resolve("/repo", "apps/api"),
  });
});
