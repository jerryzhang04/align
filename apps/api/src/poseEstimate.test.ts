import { describe, expect, it } from "vitest";
import { estimatePoseFromJpeg } from "./poseEstimate.js";

describe("estimatePoseFromJpeg", () => {
  it("rejects non-JPEG buffers before loading MoveNet", async () => {
    const started = Date.now();
    await expect(estimatePoseFromJpeg(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).resolves.toBeNull();
    await expect(estimatePoseFromJpeg(new Uint8Array([0xff, 0xd8, 0x00]))).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
