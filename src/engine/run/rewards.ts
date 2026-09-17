import type { Card, Rarity, Relic, RelicTier, Vial } from '../../content/schema';
import type { Rng } from '../rng';
import type { Content } from '../rules';

/** docs/design.md §7.3 and §7.6. Weights are per hundred. */
export const CARD_RARITY = { fight: { common: 60, uncommon: 37, rare: 3 }, elite: { common: 50, uncommon: 40, rare: 10 } } as const;
export const RELIC_TIER = { elite: { common: 50, uncommon: 35, rare: 15 }, treasure: { common: 50, uncommon: 33, rare: 17 } } as const;
export const VIAL_RARITY = { common: 65, uncommon: 25, rare: 10 } as const;
export const GOLD = { fight: [10, 20], elite: [25, 35], boss: [95, 105] } as const;

function weightedKey<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const keys = Object.keys(weights) as K[];
  return rng.weighted(keys, keys.map((k) => weights[k]));
}

/** The pool a class draws rewards from: its own cards plus neutrals, never starters, statuses or curses. `allowed` is the profile's unlocked set. */
export function rewardPool(content: Content, classId: string, rarity: Rarity, neutral: boolean, allowed?: readonly string[]): Card[] {
  return Object.values(content.cards).filter((c) => c.rarity === rarity && (neutral ? c.class === 'neutral' : c.class === classId) && (!allowed || allowed.includes(c.id)));
}

export interface CardOffer {
  cards: string[];
  /** The Rare pity counter after this roll. */
  pity: number;
}

/** Three distinct cards: class 80% / neutral 20%, rarity by node kind, with a 1%-per-miss Rare pity. */
export function offerCards(rng: Rng, content: Content, classId: string, kind: 'fight' | 'elite' | 'boss', pity: number, count = 3, allowed?: readonly string[]): CardOffer {
  const out: string[] = [];
  let p = pity;
  for (let i = 0; i < count; i++) {
    let rarity: Rarity;
    if (kind === 'boss') rarity = 'rare';
    else {
      const base = CARD_RARITY[kind];
      const w = { common: Math.max(0, base.common - p), uncommon: base.uncommon, rare: base.rare + p };
      rarity = weightedKey(rng, w);
    }
    if (rarity === 'rare') p = 0;
    else p += 1;
    const neutral = rng.chance(0.2);
    let pool = rewardPool(content, classId, rarity, neutral, allowed).filter((c) => !out.includes(c.id));
    if (!pool.length) pool = rewardPool(content, classId, rarity, !neutral, allowed).filter((c) => !out.includes(c.id));
    if (!pool.length) pool = rewardPool(content, classId, 'common', false, allowed).filter((c) => !out.includes(c.id));
    if (pool.length) out.push(rng.pick(pool).id);
  }
  return { cards: out, pity: p };
}

export function relicPool(content: Content, classId: string, tier: RelicTier, owned: string[], allowed?: readonly string[]): Relic[] {
  return Object.values(content.relics ?? {}).filter((r) => r.tier === tier && (!r.class || r.class === classId) && !owned.includes(r.id) && (!allowed || allowed.includes(r.id)));
}

/** One relic by tier weights, never one you own; falls to a lower tier if a pool is empty. */
export function rollRelic(rng: Rng, content: Content, classId: string, source: 'elite' | 'treasure', owned: string[], allowed?: readonly string[]): string | null {
  const tier = weightedKey(rng, RELIC_TIER[source]) as RelicTier;
  const order: RelicTier[] = tier === 'rare' ? ['rare', 'uncommon', 'common'] : tier === 'uncommon' ? ['uncommon', 'common', 'rare'] : ['common', 'uncommon', 'rare'];
  for (const t of order) {
    const pool = relicPool(content, classId, t, owned, allowed);
    if (pool.length) return rng.pick(pool).id;
  }
  return null;
}

export function rollBossRelics(rng: Rng, content: Content, classId: string, owned: string[], count = 3, allowed?: readonly string[]): string[] {
  const pool = rng.shuffle(relicPool(content, classId, 'boss', owned, allowed));
  return pool.slice(0, count).map((r) => r.id);
}

export function rollVial(rng: Rng, content: Content): string | null {
  const rarity = weightedKey(rng, VIAL_RARITY);
  const pool = Object.values(content.vials ?? {}).filter((v: Vial) => v.rarity === rarity);
  return pool.length ? rng.pick(pool).id : null;
}

export function rollGold(rng: Rng, kind: 'fight' | 'elite' | 'boss', mult = 1): number {
  const [lo, hi] = GOLD[kind];
  return Math.round(rng.int(lo, hi) * mult);
}
