import { BUFFS, DEBUFFS, type CardTag, type StatusId } from '../../content/schema';
import { type Combatant, combatant, HERO_ID, idOf, isEnemy } from './entities';
import { FREEZE_AT, getStatus, isDebuff, SHATTER_DAMAGE } from './statuses';
import type { CombatState, Content, EffectContext } from './types';

/**
 * The mutation primitives. Every change to HP, block or a status goes
 * through here, and every one of them emits.
 */

export interface DamageOptions {
  source: EffectContext['source'];
  /** Attacks interact with Images, Thorns, Mark and the trap negation flag. */
  attack: boolean;
  tags?: CardTag[];
}

export interface DamageResult {
  dealt: number;
  blocked: number;
  hpDamage: number;
  negated: boolean;
}

/**
 * The one place HP goes down. `amount` is already modified (Strength,
 * Vulnerable, Mark); this handles Images, Intangible, block, Plated Armor,
 * Bound, Thorns, death, and emits.
 */
export function dealDamage(state: CombatState, content: Content, targetId: string, amount: number, opts: DamageOptions): DamageResult {
  const target = combatant(state, targetId);
  const none: DamageResult = { dealt: 0, blocked: 0, hpDamage: 0, negated: false };
  if (!target) return none;
  if (isEnemy(target) && !target.alive) return none;

  if (opts.attack && targetId === HERO_ID) {
    if (state.hero.flags.negateNextAttack) {
      delete state.hero.flags.negateNextAttack;
      state.events.push({ t: 'negated', target: targetId, by: 'trap' });
      return { ...none, negated: true };
    }
    if (getStatus(state.hero.statuses, 'images') > 0) {
      state.hero.statuses.images = getStatus(state.hero.statuses, 'images') - 1;
      if (state.hero.statuses.images === 0) delete state.hero.statuses.images;
      state.events.push({ t: 'status', target: targetId, status: 'images', delta: -1, total: getStatus(state.hero.statuses, 'images') });
      state.events.push({ t: 'negated', target: targetId, by: 'images' });
      return { ...none, negated: true };
    }
  }

  let dealt = Math.max(0, Math.floor(amount));
  if (opts.attack && targetId === HERO_ID && state.hero.flags.wardingCharm) {
    delete state.hero.flags.wardingCharm;
    dealt = Math.floor(dealt / 2);
  }
  if (getStatus(target.statuses, 'intangible') > 0 && dealt > 1) {
    dealt = 1;
    state.events.push({ t: 'negated', target: targetId, by: 'intangible' });
  }

  const blocked = Math.min(target.block, dealt);
  target.block -= blocked;
  const hpDamage = dealt - blocked;
  target.hp = Math.max(0, target.hp - hpDamage);

  if (hpDamage > 0) {
    const plated = getStatus(target.statuses, 'platedArmor');
    if (plated > 0) {
      target.statuses.platedArmor = plated - 1;
      if (target.statuses.platedArmor === 0) delete target.statuses.platedArmor;
      state.events.push({ t: 'status', target: targetId, status: 'platedArmor', delta: -1, total: plated - 1 });
    }
    if (targetId === HERO_ID) {
      state.hero.turn.damageTaken += hpDamage;
      for (const c of state.piles.hand) c.bound = false;
    }
  }

  const killed = target.hp <= 0;
  state.events.push({
    t: 'damage',
    target: targetId,
    amount: dealt,
    blocked,
    hp: target.hp,
    source: sourceId(opts.source),
    killed,
  });

  // Thorns hits back at whoever swung, as plain damage.
  const thorns = getStatus(target.statuses, 'thorns');
  const attackerId = sourceId(opts.source);
  if (opts.attack && thorns > 0 && attackerId && attackerId !== targetId) {
    dealDamage(state, content, attackerId, thorns, { source: { kind: 'system' }, attack: false });
  }

  if (killed) die(state, content, target);
  return { dealt, blocked, hpDamage, negated: false };
}

function sourceId(source: EffectContext['source']): string | undefined {
  if (source.kind === 'hero' || source.kind === 'companion' || source.kind === 'trap' || source.kind === 'power') return HERO_ID;
  if (source.kind === 'enemy') return source.id;
  return undefined;
}

function die(state: CombatState, content: Content, target: Combatant): void {
  if (isEnemy(target)) {
    if (!target.alive) return;
    target.alive = false;
    target.intent = null;
    state.events.push({ t: 'die', target: target.id });
    state.hero.flags.enemyDiedThisTurn = true;
    const def = content.enemies[target.enemyId];
    if (def?.onDeath?.length) state.queue.unshift(...def.onDeath.map((effect) => ({ effect, ctx: { source: { kind: 'enemy' as const, id: target.id }, targetId: HERO_ID } })));
    // Living Bomb: the blast hits everyone else.
    const bomb = getStatus(target.statuses, 'bomb');
    if (bomb > 0) {
      for (const other of state.enemies) {
        if (other.alive && other.id !== target.id) dealDamage(state, content, other.id, bomb, { source: { kind: 'system' }, attack: false });
      }
    }
    return;
  }
  // The hero. A once-per-fight revive (Divine Intervention, Phoenix Feather).
  if (state.hero.flags.reviveOnce) {
    delete state.hero.flags.reviveOnce;
    state.hero.hp = Math.max(1, Math.ceil(state.hero.maxHp * 0.3));
    state.events.push({ t: 'heal', target: HERO_ID, amount: state.hero.hp, hp: state.hero.hp });
    return;
  }
  state.phase = 'lost';
  state.events.push({ t: 'die', target: HERO_ID });
  state.events.push({ t: 'end', result: 'lost' });
}

/** Direct HP loss that ignores block: Poison. */
export function loseHp(state: CombatState, content: Content, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  if (isEnemy(target) && !target.alive) return;
  target.hp = Math.max(0, target.hp - amount);
  const killed = target.hp <= 0;
  state.events.push({ t: 'damage', target: idOf(target), amount, blocked: 0, hp: target.hp, killed });
  if (killed) die(state, content, target);
}

export function heal(state: CombatState, target: Combatant, amount: number): number {
  if (amount <= 0) return 0;
  if (isEnemy(target) && !target.alive) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  let healed = target.hp - before;
  // Beacon: healing past full becomes block.
  if (!isEnemy(target) && state.hero.flags.beacon && amount > healed) {
    gainBlock(state, target, amount - healed, true);
  }
  if (healed > 0 || amount > 0) state.events.push({ t: 'heal', target: idOf(target), amount: healed, hp: target.hp });
  healed = Math.max(0, healed);
  return healed;
}

export function gainBlock(state: CombatState, target: Combatant, amount: number, flat = false): number {
  if (isEnemy(target) && !target.alive) return 0;
  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0 && !flat) return 0;
  target.block += gained;
  state.events.push({ t: 'block', target: idOf(target), amount: gained, total: target.block });
  return gained;
}

function setStatus(target: Combatant, id: StatusId, value: number): void {
  if (value <= 0) delete target.statuses[id];
  else target.statuses[id] = value;
}

/**
 * Apply `delta` stacks of a status. Handles Artifact (a debuff is negated and
 * consumes one) and the Chill threshold (Frozen, or Shatter for elites and
 * bosses), and emits. Returns the actual change.
 */
export function applyStatus(state: CombatState, content: Content, targetId: string, status: StatusId, delta: number): number {
  const target = combatant(state, targetId);
  if (!target || delta === 0) return 0;
  if (isEnemy(target) && !target.alive) return 0;

  if (delta > 0 && isDebuff(status) && getStatus(target.statuses, 'artifact') > 0) {
    const left = getStatus(target.statuses, 'artifact') - 1;
    setStatus(target, 'artifact', left);
    state.events.push({ t: 'status', target: targetId, status: 'artifact', delta: -1, total: left });
    return 0;
  }

  const before = getStatus(target.statuses, status);
  const after = Math.max(0, before + delta);
  setStatus(target, status, after);
  state.events.push({ t: 'status', target: targetId, status, delta: after - before, total: after });

  if (!isEnemy(target) && delta > 0 && state.phase === 'enemy' && ROUND_DECAY.includes(status) && !state.hero.fresh.includes(status)) {
    state.hero.fresh.push(status);
  }

  if (status === 'chill' && after >= FREEZE_AT && isEnemy(target)) {
    setStatus(target, 'chill', 0);
    state.events.push({ t: 'status', target: targetId, status: 'chill', delta: -after, total: 0 });
    const rank = content.enemies[target.enemyId]?.rank ?? 'normal';
    if (rank === 'boss' || rank === 'elite') {
      dealDamage(state, content, targetId, SHATTER_DAMAGE, { source: { kind: 'system' }, attack: false });
    } else {
      setStatus(target, 'frozen', 1);
      state.events.push({ t: 'status', target: targetId, status: 'frozen', delta: 1, total: 1 });
    }
  }
  return after - before;
}

export function removeStatus(state: CombatState, targetId: string, which: StatusId | 'debuffs' | 'buffs'): void {
  const target = combatant(state, targetId);
  if (!target) return;
  const ids: StatusId[] = which === 'debuffs' ? [...DEBUFFS] : which === 'buffs' ? [...BUFFS] : [which];
  for (const id of ids) {
    const before = getStatus(target.statuses, id);
    if (before === 0) continue;
    setStatus(target, id, 0);
    state.events.push({ t: 'status', target: targetId, status: id, delta: -before, total: 0 });
  }
}

/** Statuses that wear off by one each round. */
export const ROUND_DECAY: readonly StatusId[] = ['vulnerable', 'weak', 'frail', 'chill', 'intangible'];

/**
 * The hero's end-of-round decay: after the enemies act. A debuff an enemy
 * applied this round is skipped once (StS's "just applied" rule).
 */
export function decayHeroRound(state: CombatState): void {
  for (const id of ROUND_DECAY) {
    if (state.hero.fresh.includes(id)) continue;
    decay(state, state.hero, id);
  }
  state.hero.fresh = [];
}

/** Decrement a status by one, if present. */
export function decay(state: CombatState, target: Combatant, id: StatusId): void {
  const v = getStatus(target.statuses, id);
  if (v <= 0) return;
  setStatus(target, id, v - 1);
  state.events.push({ t: 'status', target: idOf(target), status: id, delta: -1, total: v - 1 });
}

/** Set a status to an exact value, emitting the difference. Used by ticks (Poison X → X−1). */
export function setStatusTo(state: CombatState, target: Combatant, id: StatusId, value: number): void {
  const before = getStatus(target.statuses, id);
  const after = Math.max(0, value);
  if (before === after) return;
  setStatus(target, id, after);
  state.events.push({ t: 'status', target: idOf(target), status: id, delta: after - before, total: after });
}
