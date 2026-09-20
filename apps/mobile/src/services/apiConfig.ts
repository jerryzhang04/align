export type CoachApiConfig = {
  baseUrl: string;
  token: string;
  host: string;
  loopback: boolean;
};

const DEFAULT_PORT = 8788;

export function isLoopbackHost(host: string) {
  const value = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return value === "localhost" || value === "127.0.0.1" || value === "0.0.0.0" || value === "::1";
}

export function hostnameFromHint(raw: string | null | undefined) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    return url.hostname || null;
  } catch {
    const host = trimmed.split("/")[0]?.split(":")[0];
    return host || null;
  }
}

function ipv4Octets(host: string) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

export function sameLanSite(left: string, right: string) {
  const a = ipv4Octets(left);
  const b = ipv4Octets(right);
  if (!a || !b) return left === right;
  return a[0] === b[0] && a[1] === b[1];
}

function portFromUrl(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  try {
    const port = Number(new URL(value).port);
    return Number.isInteger(port) && port > 0 ? port : fallback;
  } catch {
    return fallback;
  }
}

export function resolveCoachApiUrl(input: {
  envUrl?: string;
  envToken?: string;
  hostHints?: Array<string | null | undefined>;
} = {}): CoachApiConfig {
  const envUrl = (input.envUrl ?? "").trim().replace(/\/$/, "");
  const token = (input.envToken ?? "").trim();
  const envHost = envUrl ? hostnameFromHint(envUrl) : null;
  // Keep deployed/tunnel endpoints intact, including HTTPS and path prefixes.
  // Only auto-repair local development addresses using Metro's LAN host.
  if (envHost && !isLoopbackHost(envHost) && !ipv4Octets(envHost)) {
    return { baseUrl: envUrl, token, host: envHost, loopback: false };
  }
  const expoHost = (input.hostHints ?? [])
    .map(hostnameFromHint)
    .find((host): host is string => typeof host === "string" && host.length > 0 && !isLoopbackHost(host));
  const port = portFromUrl(envUrl, DEFAULT_PORT);

  let host = envHost;
  if (expoHost) {
    if (!envHost || isLoopbackHost(envHost)) host = expoHost;
    else if (!sameLanSite(envHost, expoHost)) host = expoHost;
  }
  if (!host) host = "127.0.0.1";

  const loopback = isLoopbackHost(host);
  return {
    baseUrl: `http://${host}:${port}`,
    token,
    host,
    loopback,
  };
}
