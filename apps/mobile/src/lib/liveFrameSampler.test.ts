import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVE_FRAME_INTERVAL_MS,
  createLiveFrameSampler,
} from "./liveFrameSampler";

describe("live frame sampler", () => {
  it("allows the first sample and then enforces the configured interval", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 1000 });

    expect(sampler.shouldSample(0)).toBe(true);
    expect(sampler.tryStart(0)).toBe(true);
    sampler.markCaptureComplete();

    expect(sampler.shouldSample(999)).toBe(false);
    expect(sampler.shouldSample(1000)).toBe(true);
  });

  it("uses a 750ms default interval", () => {
    const sampler = createLiveFrameSampler();

    expect(DEFAULT_LIVE_FRAME_INTERVAL_MS).toBe(750);
    expect(sampler.tryStart(1000)).toBe(true);
    sampler.markCaptureComplete();

    expect(sampler.shouldSample(1749)).toBe(false);
    expect(sampler.shouldSample(1750)).toBe(true);
  });

  it("does not overlap an in-flight capture", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 0 });

    expect(sampler.tryStart(100)).toBe(true);
    expect(sampler.shouldSample(100)).toBe(false);
    expect(sampler.tryStart(101)).toBe(false);

    sampler.markCaptureComplete();
    expect(sampler.tryStart(102)).toBe(true);
  });

  it("can release a failed capture so a later sample can be attempted", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 100 });

    expect(sampler.tryStart(100)).toBe(true);
    sampler.markCaptureFailure();

    expect(sampler.shouldSample(199)).toBe(false);
    expect(sampler.tryStart(200)).toBe(true);
  });

  it("rejects sampling while an external capture is in flight", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 0 });

    expect(sampler.shouldSample(10, true)).toBe(false);
    expect(sampler.tryStart(10, true)).toBe(false);
    expect(sampler.tryStart(10)).toBe(true);
  });

  it("stops sampling until restarted", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 1000 });

    sampler.stop();
    expect(sampler.shouldSample(0)).toBe(false);
    expect(sampler.tryStart(0)).toBe(false);

    sampler.restart();
    expect(sampler.tryStart(0)).toBe(true);
  });

  it("resets cadence and in-flight state", () => {
    const sampler = createLiveFrameSampler({ intervalMs: 1000 });

    expect(sampler.tryStart(100)).toBe(true);
    sampler.reset();

    expect(sampler.tryStart(100)).toBe(true);
  });
});
