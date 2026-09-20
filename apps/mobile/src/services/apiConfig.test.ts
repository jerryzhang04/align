import { describe, expect, it } from "vitest";
import { hostnameFromHint, isLoopbackHost, resolveCoachApiUrl, sameLanSite } from "./apiConfig";

describe("resolveCoachApiUrl", () => {
  it("keeps an explicit LAN API URL when it matches Expo's host network", () => {
    expect(resolveCoachApiUrl({
      envUrl: "http://192.168.1.44:8788",
      envToken: "token",
      hostHints: ["192.168.1.44:8081"],
    })).toEqual({
      baseUrl: "http://192.168.1.44:8788",
      token: "token",
      host: "192.168.1.44",
      loopback: false,
    });
  });

  it("does not send a physical iPhone to 127.0.0.1 when Metro already has a LAN host", () => {
    expect(resolveCoachApiUrl({
      envUrl: "http://127.0.0.1:8788",
      hostHints: ["exp://192.168.1.44:8081"],
    })).toMatchObject({
      baseUrl: "http://192.168.1.44:8788",
      host: "192.168.1.44",
      loopback: false,
    });
  });

  it("ignores a Windows virtual-adapter API URL that is not on the phone's Wi-Fi", () => {
    expect(resolveCoachApiUrl({
      envUrl: "http://172.29.160.1:8788",
      hostHints: ["192.168.1.44:8081"],
    })).toMatchObject({
      baseUrl: "http://192.168.1.44:8788",
      host: "192.168.1.44",
      loopback: false,
    });
  });

  it("allows loopback when Expo itself is loopback, which is the iOS Simulator case", () => {
    expect(resolveCoachApiUrl({
      envUrl: "http://127.0.0.1:8788",
      hostHints: ["127.0.0.1:8081"],
    })).toMatchObject({
      baseUrl: "http://127.0.0.1:8788",
      loopback: true,
    });
  });
});

describe("hostnameFromHint", () => {
  it("reads Expo Go debugger and linking hosts", () => {
    expect(hostnameFromHint("192.168.1.44:8081")).toBe("192.168.1.44");
    expect(hostnameFromHint("exp://192.168.1.44:8081")).toBe("192.168.1.44");
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(sameLanSite("192.168.1.44", "192.168.1.12")).toBe(true);
    expect(sameLanSite("192.168.1.44", "172.29.160.1")).toBe(false);
  });
});
