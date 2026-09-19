import { describe, expect, it } from "vitest";
import { resolveServerAddress } from "./serverConfig.js";

describe("resolveServerAddress", () => {
  it("keeps ordinary development bound to loopback", () => {
    expect(resolveServerAddress({})).toEqual({ hostname: "127.0.0.1", port: 8788 });
  });

  it("allows the iPhone launcher to opt into a LAN bind", () => {
    expect(resolveServerAddress({ HOST: "0.0.0.0", PORT: "9123" })).toEqual({
      hostname: "0.0.0.0",
      port: 9123,
    });
  });

  it("rejects invalid ports before starting the server", () => {
    expect(() => resolveServerAddress({ PORT: "not-a-port" })).toThrow("invalid_port");
    expect(() => resolveServerAddress({ PORT: "70000" })).toThrow("invalid_port");
  });
});
