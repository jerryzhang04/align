import { describe, expect, it } from "vitest";
import { fetchWithTimeout, coachErrorMessage } from "./request";

describe("coach requests", () => {
  it("bounds an unresponsive network request", async () => {
    const hangingFetch = async (_url: string, init?: RequestInit): Promise<Response> => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    await expect(fetchWithTimeout("http://example.test", {}, 5, hangingFetch)).rejects.toThrow("request_timeout");
  });
  it("explains stale API authorization instead of showing a generic error", () => {
    expect(coachErrorMessage(new Error("unauthorized"))).toContain("reopen");
  });
  it("explains provider failure without claiming the scan was lost", () => {
    expect(coachErrorMessage(new Error("omni_failed"))).toContain("provider");
  });
  it("does not call a loopback or parse failure a Wi-Fi problem", () => {
    expect(coachErrorMessage(new Error("coach_loopback_url"))).toContain("127.0.0.1");
    expect(coachErrorMessage(new Error("Network request failed"))).toContain("port 8788");
    const invalid = new Error("invalid");
    invalid.name = "ZodError";
    expect(coachErrorMessage(invalid)).toContain("could not be verified");
    expect(coachErrorMessage(new Error("something-else"))).not.toContain("Wi-Fi");
  });
});
