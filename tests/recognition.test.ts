import { describe, expect, it } from "vitest";
import { classify, normalizeRgba, StabilityGate } from "../src/lib/recognition";

describe("model output safety", () => {
  it("preserves the trained compact label mapping after the missing J", () => {
    const logits = Array(25).fill(-10);
    logits[9] = 10;
    expect(classify(logits).letter).toBe("K");
    logits[9] = -10;
    logits[23] = 10;
    expect(classify(logits).letter).toBe("Y");
  });
  it("rejects the unused 25th output, uncertainty, and invalid outputs", () => {
    const logits = Array(25).fill(-10);
    logits[24] = 10;
    expect(classify(logits).letter).toBeNull();
    expect(classify(Array(25).fill(0)).letter).toBeNull();
    expect(classify([NaN]).letter).toBeNull();
    expect(classify(Array(25).fill(Infinity)).letter).toBeNull();
  });
  it("matches the original training grayscale normalization", () => {
    const data = normalizeRgba(
      new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255]),
    );
    expect(data[0]).toBeCloseTo(-0.485 / 0.229);
    expect(data[1]).toBeCloseTo((1 - 0.485) / 0.229);
    expect(data[2]).toBeCloseTo((0.299 - 0.485) / 0.229);
  });
});
describe("letter capture", () => {
  it("commits stable signs once and requires a real hand release to repeat", () => {
    const gate = new StabilityGate();
    expect(gate.update("A", 0).committed).toBeNull();
    expect(gate.update("A", 849).committed).toBeNull();
    expect(gate.update("A", 850).committed).toBe("A");
    expect(gate.update("A", 1800).committed).toBeNull();
    gate.update(null, 1900, true);
    gate.update(null, 2500, true);
    gate.update("A", 2600);
    expect(gate.update("A", 3500).committed).toBeNull();
    gate.update(null, 3600, false);
    gate.update(null, 4100, false);
    gate.update("A", 4200);
    expect(gate.update("A", 5100).committed).toBe("A");
  });
  it("allows consecutive different letters and resets unstable candidates", () => {
    const gate = new StabilityGate();
    gate.update("A", 0);
    gate.update("B", 500);
    expect(gate.update("B", 850).committed).toBeNull();
    expect(gate.update("B", 1350).committed).toBe("B");
    gate.update("C", 1500);
    expect(gate.update("C", 2400).committed).toBe("C");
    gate.reset();
    gate.update("C", 2500);
    expect(gate.update("C", 3400).committed).toBe("C");
  });
});
