function isPrivateIpv4(address) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function privateAddresses(entries = []) {
  return entries
    .filter((entry) => (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address)
    .filter(isPrivateIpv4);
}

export function selectLanAddress(interfaces) {
  const wifiAddress = privateAddresses(interfaces.en0)[0];
  if (wifiAddress) return wifiAddress;

  for (const [name, entries] of Object.entries(interfaces)) {
    if (name === "en0") continue;
    const address = privateAddresses(entries)[0];
    if (address) return address;
  }

  throw new Error("no_lan_ipv4_address");
}

export function createLaunchEnvironments(baseEnvironment, { address, port, token }) {
  const apiUrl = `http://${address}:${port}`;
  const apiEnv = {
    ...baseEnvironment,
    HOST: "0.0.0.0",
    PORT: String(port),
    ALIGN_API_TOKEN: token,
  };
  const mobileEnv = { ...baseEnvironment };

  delete mobileEnv.OMNI_API_KEY;
  delete mobileEnv.ALIGN_API_TOKEN;
  mobileEnv.EXPO_PUBLIC_ALIGN_API_URL = apiUrl;
  mobileEnv.EXPO_PUBLIC_ALIGN_API_TOKEN = token;

  return { apiEnv, mobileEnv, apiUrl };
}

export function createMobileCommandArgs(useDevClient) {
  return [
    "run",
    "start",
    "--workspace=@align/mobile",
    "--",
    "--lan",
    useDevClient ? "--dev-client" : "--go",
  ];
}

export function createApiCommand(repoRoot) {
  return {
    command: resolve(repoRoot, "node_modules/.bin/tsx"),
    args: ["watch", "src/index.ts"],
    cwd: resolve(repoRoot, "apps/api"),
  };
}
import { resolve } from "node:path";
