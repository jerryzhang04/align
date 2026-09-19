export type ServerEnvironment = Record<string, string | undefined>;

export function resolveServerAddress(environment: ServerEnvironment): { hostname: string; port: number } {
  const hostname = environment.HOST?.trim() || "127.0.0.1";
  const port = Number(environment.PORT?.trim() || "8788");

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("invalid_port");
  }

  return { hostname, port };
}
