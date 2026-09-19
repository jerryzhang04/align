import { describe, expect, it } from "vitest";
import { createOperationGate } from "./operationGate";

describe("operation gate", () => {
  it("rejects work that finishes after the user has cancelled it", () => {
    const gate = createOperationGate();
    const operation = gate.begin();

    gate.cancel();

    expect(gate.isActive(operation)).toBe(false);
  });

  it("keeps a newer operation active while rejecting the older one", () => {
    const gate = createOperationGate();
    const older = gate.begin();
    const newer = gate.begin();

    expect(gate.isActive(older)).toBe(false);
    expect(gate.isActive(newer)).toBe(true);
  });
});
