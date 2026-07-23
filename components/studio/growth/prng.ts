/**
 * Seeded randomness for the growth field.
 *
 * The forest must be deterministic: the same org always grows the same
 * forest, plants add but never reshuffle. So no Math.random anywhere in
 * the scene; every number comes from a mulberry32 stream seeded (via
 * xmur3) by the org id. Standard tiny PRNG pair, dependency-free.
 */

export type Rng = () => number;

/** xmur3 string hash: seeds for mulberry32. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

/** mulberry32: fast, uniform 0..1 stream from a 32-bit seed. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed a stream straight from a string. */
export function rngFromString(seed: string): Rng {
  return mulberry32(xmur3(seed)());
}

/** Uniform in [a, b). */
export function between(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

/** Integer in [a, b] inclusive. */
export function intBetween(rng: Rng, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

/** Pick one of a list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** Hermite smoothstep of x across [e0, e1], clamped 0..1. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
