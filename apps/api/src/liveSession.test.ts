import { describe, expect, it } from "vitest";
import { LiveSessionStore } from "./liveSession.js";
import type { ViewId } from "@align/contracts";

function frame(timestampMs: number, imageBase64 = `frame-${timestampMs}`, yaw = 0, view: ViewId = "front") {
  return {
    scanId: "scan-1",
    timestampMs,
    imageBase64,
    imageMime: "image/jpeg",
    view,
    orientation: { yaw, pitch: 0, roll: 0 },
  };
}

describe("LiveSessionStore", () => {
  it("keeps only the newest frames in each bounded scan window", () => {
    const sessions = new LiveSessionStore({ maxFramesPerScan: 3 });

    sessions.addFrame(frame(100));
    sessions.addFrame(frame(200));
    sessions.addFrame(frame(300));
    sessions.addFrame(frame(400));

    expect(sessions.selectFrames("scan-1", 3).map((sample) => sample.timestampMs)).toEqual([200, 300, 400]);
  });

  it("replaces a rapid sample with matching deterministic metadata", () => {
    const sessions = new LiveSessionStore({ dedupeWindowMs: 500 });

    sessions.addFrame({ ...frame(100, "older-jpeg", 15), fingerprint: "stable-camera-sample" });
    const result = sessions.addFrame({ ...frame(250, "newer-jpeg", 15), fingerprint: "stable-camera-sample" });

    expect(result).toMatchObject({ accepted: true, replaced: true, frameCount: 1 });
    expect(sessions.selectFrames("scan-1", 2)).toEqual([
      expect.objectContaining({ timestampMs: 250, imageBase64: "newer-jpeg" }),
    ]);
  });

  it("never deduplicates identical-looking samples across guided phases", () => {
    const sessions = new LiveSessionStore({ dedupeWindowMs: 750 });
    sessions.addFrame(frame(2_500, "same-jpeg", 0, "front"));
    sessions.addFrame(frame(3_000, "same-jpeg", 0, "right"));

    expect(sessions.selectLatestByView("scan-1", ["front", "right"]).map((sample) => sample.view)).toEqual(["front", "right"]);
  });

  it("selects a bounded chronological spread for an OMNI turn", () => {
    const sessions = new LiveSessionStore({ maxFramesForTurn: 3 });

    for (const timestampMs of [100, 200, 300, 400, 500]) sessions.addFrame(frame(timestampMs));

    expect(sessions.selectFrames("scan-1").map((sample) => sample.timestampMs)).toEqual([100, 300, 500]);
  });

  it("retains a full twelve-second scan at the default sampling cadence", () => {
    const sessions = new LiveSessionStore();
    for (let index = 0; index < 16; index += 1) sessions.addFrame(frame(index * 750));

    const selected = sessions.selectFrames("scan-1");
    expect(selected[0]?.timestampMs).toBe(0);
    expect(selected.at(-1)?.timestampMs).toBe(11_250);
  });

  it("selects one latest sample for each actual guided phase", () => {
    const sessions = new LiveSessionStore();
    sessions.addFrame(frame(0, "front-old", 0, "front"));
    sessions.addFrame(frame(500, "front-new", 0, "front"));
    sessions.addFrame(frame(3_500, "right", 0, "right"));
    sessions.addFrame(frame(6_500, "back", 0, "back"));
    sessions.addFrame(frame(9_500, "left", 0, "left"));

    expect(sessions.selectLatestByView("scan-1", ["front", "right", "back", "left"]).map((sample) => sample.imageBase64)).toEqual([
      "front-new", "right", "back", "left",
    ]);
    expect(sessions.listByView("scan-1").front).toHaveLength(2);
    expect(sessions.listByView("scan-1").right.map((sample) => sample.imageBase64)).toEqual(["right"]);
  });

  it("uses the most recent sample when a turn can include only one frame", () => {
    const sessions = new LiveSessionStore({ maxFramesForTurn: 1 });

    for (const timestampMs of [100, 200, 300]) sessions.addFrame(frame(timestampMs));

    expect(sessions.selectFrames("scan-1").map((sample) => sample.timestampMs)).toEqual([300]);
  });

  it("finalizes a turn without retaining its raw frame payloads", () => {
    const sessions = new LiveSessionStore();
    sessions.addFrame(frame(100, "sensitive-jpeg"));

    const selected = sessions.finalize("scan-1", 1);

    expect(selected).toEqual([expect.objectContaining({ imageBase64: "sensitive-jpeg" })]);
    expect(sessions.selectFrames("scan-1")).toEqual([]);
    expect(sessions.reset("scan-1")).toBe(false);
  });

  it("expires inactive scan sessions and clears their frames", () => {
    let now = 0;
    const sessions = new LiveSessionStore({ sessionTtlMs: 1_000, now: () => now });
    sessions.addFrame(frame(100));

    now = 1_001;

    expect(sessions.expire()).toEqual(["scan-1"]);
    expect(sessions.selectFrames("scan-1")).toEqual([]);
  });

  it("rejects non-JPEG samples before retaining them", () => {
    const sessions = new LiveSessionStore();

    expect(() => sessions.addFrame({ ...frame(100), imageMime: "image/png" })).toThrow("live_session_jpeg_required");
    expect(sessions.selectFrames("scan-1")).toEqual([]);
  });

  it("rejects late uploads while finalizing and can reopen after a failed turn", () => {
    const sessions = new LiveSessionStore();
    sessions.addFrame(frame(100));

    expect(sessions.beginFinalize("scan-1")).toBe(true);
    expect(() => sessions.addFrame(frame(200))).toThrow("live_session_not_accepting");
    expect(sessions.reopen("scan-1")).toBe(true);
    expect(sessions.addFrame(frame(200))).toMatchObject({ accepted: true });
  });

  it("tombstones a discarded session so a late upload cannot recreate it", () => {
    const sessions = new LiveSessionStore();
    sessions.addFrame(frame(100));

    sessions.close("scan-1");

    expect(sessions.selectFrames("scan-1")).toEqual([]);
    expect(() => sessions.addFrame(frame(200))).toThrow("live_session_not_accepting");
  });
});
