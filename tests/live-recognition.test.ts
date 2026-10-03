import { describe, expect, it } from "vitest";
import { StabilityGate } from "../src/lib/recognition";
import { LetterConsensus } from "../mobile/src/lib/live-recognition";
function logits(index: number) {
  const output = Array(25).fill(-10);
  output[index] = 10;
  return output;
}
describe("live recognition", () => {
  it("rejects a lone confident wrong letter and resets on movement or uncertainty", () => {
    const consensus = new LetterConsensus();
    expect(consensus.update(logits(0), true).stable).toBeNull();
    expect(consensus.update(logits(0), true).stable).toBe("A");
    expect(consensus.update(logits(1), true).stable).toBeNull();
    expect(consensus.update(logits(0), false).stable).toBeNull();
    expect(consensus.update(logits(0), true).stable).toBeNull();
    expect(consensus.update(Array(25).fill(0), true).stable).toBeNull();
    expect(consensus.update(logits(0), true).stable).toBeNull();
  });
  it("requires fresh multiple observations rather than accepting two stale frames", () => {
    const gate = new StabilityGate({
      holdMs: 550,
      minSamples: 3,
      maxGapMs: 1000,
      releaseMs: 300,
    });
    gate.update("A", 0);
    expect(gate.update("A", 2000).committed).toBeNull();
    expect(gate.update("A", 2550).committed).toBeNull();
    expect(gate.update("A", 2633).committed).toBe("A");
    expect(gate.update("A", 2700).committed).toBeNull();
    gate.update(null, 2800, false);
    gate.update(null, 5000, false);
    gate.update("A", 5100);
    gate.update("A", 5300);
    expect(gate.update("A", 5650).committed).toBeNull();
  });
  it("captures at 550ms on a steady fresh stream, with physical release for repeats", () => {
    const gate = new StabilityGate({
      holdMs: 550,
      minSamples: 3,
      maxGapMs: 1000,
      releaseMs: 300,
    });
    for (let now = 0; now < 550; now += 83)
      expect(gate.update("A", now).committed).toBeNull();
    expect(gate.update("A", 550).committed).toBe("A");
    gate.update(null, 600, true);
    gate.update("A", 650);
    gate.update("A", 900);
    expect(gate.update("A", 1200).committed).toBeNull();
    gate.update(null, 1300, false);
    gate.update(null, 1600, false);
    gate.update("A", 1700);
    gate.update("A", 1900);
    expect(gate.update("A", 2250).committed).toBe("A");
  });
});
