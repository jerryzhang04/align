import { describe, expect, it } from "vitest";
import { permissionDeniedMessage, recordingErrorMessage } from "./recordingError";

describe("recordingErrorMessage", () => {
  it("only mentions iOS Settings when the failure is actually a permission denial", () => {
    expect(recordingErrorMessage(new Error("Permission denied"))).toContain("iOS Settings");
    expect(permissionDeniedMessage(false)).toContain("iOS Settings");
  });

  it("does not pretend a camera audio-session clash is a Settings problem", () => {
    expect(recordingErrorMessage(new Error("Session activation failed"))).not.toContain("iOS Settings");
    expect(recordingErrorMessage(new Error("Session activation failed"))).toContain("audio session");
  });

  it("keeps the underlying recorder message for unexpected failures", () => {
    expect(recordingErrorMessage(new Error("prepareToRecordAsync exploded"))).toContain("prepareToRecordAsync exploded");
  });
});
