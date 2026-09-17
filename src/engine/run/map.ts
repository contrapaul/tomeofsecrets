import type { Rng } from '../rng';

/**
 * Chapter maps: 7 columns × 10 floors and a boss above. Six paths climb from
 * the bottom; they may merge but never cross. Node types follow the rules in
 * docs/design.md §7.2. Everything comes from the `map` stream, so a seed
 * always gives the same map.
 */

export const MAP_COLS = 7;
export const MAP_FLOORS = 10;
export const MAP_PATHS = 6;

export type NodeType = 'fight' | 'elite' | 'event' | 'merchant' | 'camp' | 'treasure' | 'unknown' | 'boss';

export interface MapNode {
  id: string;
  floor: number;
  col: number;
  type: NodeType;
  /** Ids on the floor above this node connects to. */
  next: string[];
}

export interface RunMap {
  chapter: number;
  /** floors[f] is floor f+1 (1-based in play); each has MAP_COLS slots, null where empty. */
  floors: (MapNode | null)[][];
  boss: MapNode;
}

const WEIGHTS: [NodeType, number][] = [['fight', 45], ['event', 22], ['unknown', 12], ['elite', 10], ['merchant', 6], ['camp', 5]];

export function nodeId(floor: number, col: number): string {
  return `f${floor}c${col}`;
}

export function generateMap(rng: Rng, chapter: number, opts: { moreElites?: boolean } = {}): RunMap {
  // 1. Paths. Each is a column per floor; step -1/0/+1. Two links on the same
  //    floor cross when one starts left of the other and ends right of it.
  const links: [number, number][][] = Array.from({ length: MAP_FLOORS - 1 }, () => []);
  const crosses = (f: number, from: number, to: number) => links[f]!.some(([a, b]) => (a < from && b > to) || (a > from && b < to));
  const cols: number[][] = [];
  const startCols = new Set<number>();
  for (let p = 0; p < MAP_PATHS; p++) {
    let c = rng.int(0, MAP_COLS - 1);
    // The first two paths start apart so the bottom row always offers a choice.
    if (p < 2) while (startCols.has(c)) c = rng.int(0, MAP_COLS - 1);
    startCols.add(c);
    const path = [c];
    for (let f = 1; f < MAP_FLOORS; f++) {
      const options = rng.shuffle([c - 1, c, c + 1].filter((n) => n >= 0 && n < MAP_COLS));
      const chosen = options.find((n) => !crosses(f - 1, c, n)) ?? c;
      links[f - 1]!.push([c, chosen]);
      c = chosen;
      path.push(c);
    }
    cols.push(path);
  }

  // 2. Nodes where paths pass, with links.
  const floors: (MapNode | null)[][] = Array.from({ length: MAP_FLOORS }, () => Array<MapNode | null>(MAP_COLS).fill(null));
  for (const path of cols) {
    path.forEach((c, f) => {
      floors[f]![c] ??= { id: nodeId(f + 1, c), floor: f + 1, col: c, type: 'fight', next: [] };
    });
  }
  for (const path of cols) {
    for (let f = 0; f < MAP_FLOORS - 1; f++) {
      const a = floors[f]![path[f]!]!;
      const b = floors[f + 1]![path[f + 1]!]!;
      if (!a.next.includes(b.id)) a.next.push(b.id);
    }
  }
  const boss: MapNode = { id: 'boss', floor: MAP_FLOORS + 1, col: 3, type: 'boss', next: [] };
  for (const n of floors[MAP_FLOORS - 1]!) if (n) n.next.push(boss.id);

  // 3. Types. Fixed floors first, then weighted with the adjacency rules.
  const parentsOf = (node: MapNode): MapNode[] => (floors[node.floor - 2] ?? []).filter((p): p is MapNode => !!p && p.next.includes(node.id));
  for (let f = 0; f < MAP_FLOORS; f++) {
    for (const node of floors[f]!) {
      if (!node) continue;
      const floor = f + 1;
      if (floor === 1) node.type = 'fight';
      else if (floor === 6) node.type = 'treasure';
      else if (floor === MAP_FLOORS) node.type = 'camp';
      else {
        const parents = parentsOf(node);
        const grandparents = parents.flatMap(parentsOf);
        for (let attempt = 0; attempt < 12; attempt++) {
          // Seal 1: elites appear more often.
          const t = rng.weighted(WEIGHTS.map((w) => w[0]), WEIGHTS.map((w) => (w[0] === 'elite' && opts.moreElites ? w[1] * 2 : w[1])));
          if (t === 'elite' && floor < 4) continue;
          if (t === 'camp' && floor <= 3) continue;
          if ((t === 'camp' || t === 'merchant' || t === 'elite') && parents.some((p) => p.type === t)) continue;
          if (parents.some((p) => p.type === t) && grandparents.some((g) => g.type === t)) continue;
          node.type = t;
          break;
        }
      }
    }
  }

  // 4. Guarantees: a merchant on floors 4–9 and at least two elites.
  const all = floors.flat().filter((n): n is MapNode => !!n);
  const mid = all.filter((n) => n.floor >= 4 && n.floor <= 9);
  if (!mid.some((n) => n.type === 'merchant')) {
    const pick = rng.pick(mid.filter((n) => n.type === 'fight' || n.type === 'event'));
    pick.type = 'merchant';
  }
  let elites = all.filter((n) => n.type === 'elite').length;
  while (elites < 2) {
    const candidates = mid.filter((n) => n.type === 'fight' && n.floor >= 4);
    if (!candidates.length) break;
    rng.pick(candidates).type = 'elite';
    elites++;
  }

  return { chapter, floors, boss };
}

export function findNode(map: RunMap, id: string): MapNode | null {
  if (id === 'boss') return map.boss;
  for (const row of map.floors) for (const n of row) if (n && n.id === id) return n;
  return null;
}

/** Nodes the player may move to next: the first floor at the start, else the current node's links. */
export function reachable(map: RunMap, position: string | null): MapNode[] {
  if (position === null) return map.floors[0]!.filter((n): n is MapNode => !!n);
  const here = findNode(map, position);
  if (!here) return [];
  return here.next.map((id) => findNode(map, id)).filter((n): n is MapNode => !!n);
}

/** Every path from floor 1 reaches the boss, and every node is on some path. */
export function validate(map: RunMap): string[] {
  const problems: string[] = [];
  const all = map.floors.flat().filter((n): n is MapNode => !!n);
  for (const n of all) {
    if (n.floor < MAP_FLOORS && n.next.length === 0) problems.push(`${n.id} is a dead end`);
    if (n.floor > 1 && !all.some((p) => p.next.includes(n.id))) problems.push(`${n.id} is unreachable`);
    if (n.type === 'elite' && n.floor < 4) problems.push(`${n.id} elite too early`);
    if (n.type === 'camp' && n.floor <= 3) problems.push(`${n.id} camp too early`);
  }
  const mid = all.filter((n) => n.floor >= 4 && n.floor <= 9);
  if (!mid.some((n) => n.type === 'merchant')) problems.push('no merchant on floors 4–9');
  if (all.filter((n) => n.type === 'elite').length < 2) problems.push('fewer than two elites');
  if (map.floors[5]!.some((n) => n && n.type !== 'treasure')) problems.push('floor 6 must be treasure');
  if (map.floors[9]!.some((n) => n && n.type !== 'camp')) problems.push('floor 10 must be camp');
  return problems;
}
