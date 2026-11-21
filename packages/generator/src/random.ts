/**
 * The seeded random source shared by every port (ADR 0015): mulberry32 on unsigned 32-bit
 * integers, with no floating point, so TS, Python and Rust draw the same numbers.
 */

/** Largest seed; seeds are unsigned 32-bit integers. */
export const MAX_SEED = 0xffff_ffff;

/** A deterministic stream of unsigned 32-bit integers. */
export class Random {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** The next unsigned 32-bit integer. */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** An integer in `0 .. n - 1` (`n` ≥ 1). */
  below(n: number): number {
    return this.next() % n;
  }

  /** One element of a non-empty list. */
  pick<T>(list: readonly T[]): T {
    return list[this.below(list.length)] as T;
  }
}
