import { BUFFS, DEBUFFS, type StatusId } from '../../content/schema';
import type { StatusMap } from './types';

/** Pure status maths. Mutation lives in mutate.ts. */

export function getStatus(map: StatusMap, id: StatusId): number {
  return map[id] ?? 0;
}

export function isDebuff(id: StatusId): boolean {
  return DEBUFFS.includes(id);
}

export function isBuff(id: StatusId): boolean {
  return BUFFS.includes(id);
}

/** Chill at this many stacks becomes Frozen (or Shatters a boss/elite). */
export const FREEZE_AT = 5;
export const SHATTER_DAMAGE = 15;
/** Mark: attacks against the marked enemy deal this much more; each hit eats one. */
export const MARK_BONUS = 3;

/**
 * Attack damage per hit: Strength, then Weak (×0.75), then Vulnerable (×1.5),
 * floored, then the attacker's Chill subtracted flat. Never below 0.
 */
export function calcAttackDamage(base: number, attacker: StatusMap, defender: StatusMap): number {
  let d = base + getStatus(attacker, 'strength');
  if (getStatus(attacker, 'weak') > 0) d *= 0.75;
  if (getStatus(defender, 'vulnerable') > 0) d *= 1.5;
  d = Math.floor(d) - getStatus(attacker, 'chill');
  return Math.max(0, d);
}

/** Block gained: Dexterity added, Frail ×0.75, floored, never below 0. */
export function calcBlock(base: number, gainer: StatusMap): number {
  let b = base + getStatus(gainer, 'dexterity');
  if (getStatus(gainer, 'frail') > 0) b *= 0.75;
  return Math.max(0, Math.floor(b));
}
