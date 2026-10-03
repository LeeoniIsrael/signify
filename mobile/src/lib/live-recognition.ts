import { classify } from "../../../src/lib/recognition";

/** Two recent confident observations agree; a lone spike can never commit a letter. */
export class LetterConsensus {
  private recent: (string | null)[] = [];
  reset() {
    this.recent = [];
  }
  update(logits: number[], usable: boolean) {
    const result = classify(logits);
    if (!usable || !result.letter) {
      this.reset();
      return { ...result, stable: null };
    }
    this.recent.push(result.letter);
    this.recent = this.recent.slice(-3);
    return {
      ...result,
      stable:
        this.recent.filter((letter) => letter === result.letter).length >= 2
          ? result.letter
          : null,
    };
  }
}
