import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { findNode, generateMap, MAP_FLOORS, reachable, validate } from './map';

describe('map generation', () => {
  it('obeys every rule across many seeds', () => {
    for (let i = 0; i < 300; i++) {
      const map = generateMap(Rng.fromSeed(`map-${i}`), 1);
      expect(validate(map), `seed map-${i}`).toEqual([]);
    }
  });

  it('is deterministic per seed', () => {
    const a = generateMap(Rng.fromSeed('same'), 1);
    const b = generateMap(Rng.fromSeed('same'), 1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = generateMap(Rng.fromSeed('other'), 1);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('never lets two links cross', () => {
    for (let i = 0; i < 300; i++) {
      const map = generateMap(Rng.fromSeed(`x-${i}`), 1);
      for (let f = 0; f < MAP_FLOORS - 1; f++) {
        const links: [number, number][] = [];
        for (const n of map.floors[f]!) if (n) for (const id of n.next) links.push([n.col, findNode(map, id)!.col]);
        for (const [a1, b1] of links) for (const [a2, b2] of links) {
          expect(a1 < a2 && b1 > b2, `seed x-${i} floor ${f + 1}: ${a1}→${b1} crosses ${a2}→${b2}`).toBe(false);
        }
      }
    }
  });

  it('a walk from any start reaches the boss', () => {
    const map = generateMap(Rng.fromSeed('walk'), 1);
    for (const start of reachable(map, null)) {
      let node = start;
      let steps = 0;
      while (node.id !== 'boss' && steps++ < 20) node = reachable(map, node.id)[0]!;
      expect(node.id).toBe('boss');
    }
  });

  it('has a sensible mix of node types', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const map = generateMap(Rng.fromSeed(`mix-${i}`), 1);
      for (const n of map.floors.flat()) if (n) counts[n.type] = (counts[n.type] ?? 0) + 1;
    }
    expect(counts['fight']).toBeGreaterThan(counts['event']!);
    expect(counts['event']).toBeGreaterThan(counts['merchant']!);
    expect(counts['unknown']).toBeGreaterThan(0);
  });
});
