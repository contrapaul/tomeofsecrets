/**
 * Seeded randomness. sfc32 for the generator, cyrb128 to turn a seed string
 * into state. Both are small, fast and well known.
 *
 * A run has one seed and many *named streams*, each seeded from
 * `seed + ':' + name`, so a choice on one stream (which card reward you
 * took) never perturbs another (what the next enemy does). Streams
 * serialise to four integers and restore exactly.
 */

export type RngState = [number, number, number, number];

function cyrb128(str: string): RngState {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  static fromSeed(seed: string): Rng {
    const rng = new Rng(cyrb128(seed));
    // Discard a few outputs so similar seeds diverge immediately.
    for (let i = 0; i < 12; i++) rng.next();
    return rng;
  }

  /** Float in [0, 1). */
  next(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Weighted pick; weights need not sum to 1. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]!;
      if (r < 0) return items[i]!;
    }
    return items[items.length - 1]!;
  }

  /** Fisher–Yates, in place. Returns the same array. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  state(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  toJSON(): RngState {
    return this.state();
  }
}

export const STREAM_NAMES = ['map', 'encounters', 'shuffle', 'enemyMoves', 'rewards', 'events', 'shop', 'misc'] as const;
export type StreamName = (typeof STREAM_NAMES)[number];
export type Streams = Record<StreamName, Rng>;
export type StreamStates = Record<StreamName, RngState>;

export function createStreams(seed: string): Streams {
  const out = {} as Streams;
  for (const name of STREAM_NAMES) out[name] = Rng.fromSeed(`${seed}:${name}`);
  return out;
}

export function saveStreams(streams: Streams): StreamStates {
  const out = {} as StreamStates;
  for (const name of STREAM_NAMES) out[name] = streams[name].state();
  return out;
}

export function restoreStreams(states: StreamStates): Streams {
  const out = {} as Streams;
  for (const name of STREAM_NAMES) out[name] = new Rng(states[name]);
  return out;
}

/** A readable seed for new runs: `moss-7f3a-9c21`. Caller supplies the entropy. */
export function formatSeed(entropy: number): string {
  const words = ['moss', 'ink', 'gold', 'ash', 'frost', 'ember', 'rune', 'thorn', 'tide', 'glyph', 'wisp', 'page'];
  const w = words[Math.abs(entropy) % words.length]!;
  const hex = (Math.abs(entropy) >>> 0).toString(16).padStart(8, '0');
  return `${w}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
