import { describe, expect, it } from 'vitest';
import { createStreams, formatSeed, restoreStreams, Rng, saveStreams } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = Rng.fromSeed('moss-1');
    const b = Rng.fromSeed('moss-1');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between nearby seeds', () => {
    const a = Rng.fromSeed('moss-1');
    const b = Rng.fromSeed('moss-2');
    expect(a.next()).not.toBe(b.next());
  });

  it('stays in range and is roughly uniform', () => {
    const rng = Rng.fromSeed('uniform');
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(1700);
  });

  it('int is inclusive on both ends', () => {
    const rng = Rng.fromSeed('int');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('weighted picks follow the weights', () => {
    const rng = Rng.fromSeed('weights');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10000; i++) counts[rng.weighted(['a', 'b', 'c'] as const, [50, 30, 20])]++;
    expect(counts.a).toBeGreaterThan(counts.b);
    expect(counts.b).toBeGreaterThan(counts.c);
    expect(counts.a / 10000).toBeCloseTo(0.5, 1);
  });

  it('shuffle is a permutation', () => {
    const rng = Rng.fromSeed('shuffle');
    const items = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...items].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(items).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('saves and restores exactly', () => {
    const rng = Rng.fromSeed('save');
    rng.next();
    rng.next();
    const saved = rng.state();
    const copy = new Rng(saved);
    expect(Array.from({ length: 5 }, () => copy.next())).toEqual(Array.from({ length: 5 }, () => rng.next()));
    expect(JSON.parse(JSON.stringify(rng))).toEqual(rng.state());
  });
});

describe('streams', () => {
  it('are independent: draining one does not move another', () => {
    const s1 = createStreams('run-1');
    const s2 = createStreams('run-1');
    for (let i = 0; i < 100; i++) s1.rewards.next();
    expect(s1.enemyMoves.next()).toBe(s2.enemyMoves.next());
  });

  it('round-trip through save/restore', () => {
    const s = createStreams('run-2');
    s.map.next();
    s.shuffle.next();
    const restored = restoreStreams(JSON.parse(JSON.stringify(saveStreams(s))));
    expect(restored.map.next()).toBe(s.map.next());
    expect(restored.shuffle.next()).toBe(s.shuffle.next());
  });

  it('formats a readable seed', () => {
    expect(formatSeed(0x7f3a9c21)).toMatch(/^[a-z]+-[0-9a-f]{4}-[0-9a-f]{4}$/);
  });
});
