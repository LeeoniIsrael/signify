/** Sign-MNIST remaps labels after omitting J. The export has one unused output. */
export const LETTERS = "ABCDEFGHIKLMNOPQRSTUVWXY";
export const MIN_CONFIDENCE = 0.8;
export type Prediction = { letter: string | null; confidence: number };

export function classify(logits: ArrayLike<number>): Prediction {
  if (
    logits.length !== 25 ||
    Array.from(logits).some((x) => !Number.isFinite(x))
  )
    return { letter: null, confidence: 0 };
  const max = Math.max(...Array.from(logits));
  const probabilities = Array.from(logits, (x) => Math.exp(x - max));
  const sum = probabilities.reduce((a, b) => a + b, 0);
  const index = probabilities.indexOf(Math.max(...probabilities));
  const confidence = probabilities[index] / sum;
  return {
    letter:
      index < LETTERS.length && confidence >= MIN_CONFIDENCE
        ? LETTERS[index]
        : null,
    confidence,
  };
}

export function normalizeRgba(pixels: Uint8ClampedArray): Float32Array {
  const data = new Float32Array(pixels.length / 4);
  for (let i = 0; i < data.length; i++) {
    const gray =
      (0.299 * pixels[i * 4] +
        0.587 * pixels[i * 4 + 1] +
        0.114 * pixels[i * 4 + 2]) /
      255;
    data[i] = (gray - 0.485) / 0.229;
  }
  return data;
}

/** A held sign commits once. Release for 450ms before repeating the same letter. */
export class StabilityGate {
  private candidate: string | null = null;
  private since = 0;
  private last: string | null = null;
  private absentSince: number | null = null;
  reset() {
    this.candidate = null;
    this.since = 0;
    this.last = null;
    this.absentSince = null;
  }
  update(
    letter: string | null,
    now: number,
    hasHand = true,
  ): { committed: string | null; progress: number } {
    if (!hasHand) {
      this.absentSince ??= now;
      if (now - this.absentSince >= 450) this.last = null;
    } else this.absentSince = null;
    if (!letter) {
      this.candidate = null;
      return { committed: null, progress: 0 };
    }
    if (letter !== this.candidate) {
      this.candidate = letter;
      this.since = now;
    }
    const progress = Math.min(1, (now - this.since) / 850);
    if (progress === 1 && letter !== this.last) {
      this.last = letter;
      return { committed: letter, progress };
    }
    return { committed: null, progress };
  }
}
