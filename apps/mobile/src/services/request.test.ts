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
});
