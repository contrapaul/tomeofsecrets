import type { Amount, Condition, Effect, PowerTrigger, ResourceName, Target, TrapTrigger } from '../../content/schema';
import { cardOf, hasKeyword, makeInstance } from './cards';
import { aliveEnemies, combatant, COMPANION_ID, enemy, HERO_ID, isEnemy } from './entities';
import { applyStatus, dealDamage, gainBlock, heal, removeStatus } from './mutate';
import { scripts } from './scripts';
import { calcAttackDamage, calcBlock, getStatus, MARK_BONUS } from './statuses';
import type { CardInstance, CombatState, Content, EffectContext, EnemyInstance, QueuedEffect } from './types';

/** Internal steps the engine queues alongside content effects. */
export type InternalEffect = { do: '_finishCard'; uid: number } | { do: '_companionAct'; bonus: number };
export type AnyEffect = Effect | InternalEffect;

export const RESOURCE_CAP: Record<ResourceName, number> = { holyPower: 5, charge: 4 };
export const HAND_LIMIT = 10;
export const TRAP_LIMIT = 2;

/** Push effects to the *front* of the queue: nested effects resolve before their siblings. */
export function enqueue(state: CombatState, effects: readonly AnyEffect[], ctx: EffectContext): void {
  const items: QueuedEffect[] = effects.map((effect) => ({ effect: effect as Effect, ctx }));
  state.queue.unshift(...items);
}

/** Resolve until the queue is empty, a prompt opens, or the fight ends. */
export function runQueue(state: CombatState, content: Content): void {
  while (state.queue.length > 0 && !state.prompt && (state.phase === 'player' || state.phase === 'enemy')) {
    const next = state.queue.shift()!;
    resolveOne(state, content, next.effect as AnyEffect, next.ctx);
  }
}

// ---------------------------------------------------------------- amounts

export function evalAmount(state: CombatState, amount: Amount, ctx: EffectContext): number {
  if (typeof amount === 'number') return amount;
  const hero = state.hero;
  const target = ctx.targetId ? combatant(state, ctx.targetId) : null;
  let v = 0;
  switch (amount.per) {
    case 'holyPower': v = hero.resources.holyPower; break;
    case 'charge': v = hero.resources.charge; break;
    case 'block': v = hero.block; break;
    case 'targetBurn': v = target ? getStatus(target.statuses, 'burn') : 0; break;
    case 'targetChill': v = target ? getStatus(target.statuses, 'chill') : 0; break;
    case 'targetMark': v = target ? getStatus(target.statuses, 'mark') : 0; break;
    case 'cardsInHand': v = state.piles.hand.length; break;
    case 'energy': v = hero.energy; break;
    case 'spent': v = ctx.spent ?? ctx.x ?? 0; break;
    case 'strength': v = getStatus(hero.statuses, 'strength'); break;
  }
  return amount.base + Math.floor(v * amount.mult);
}

export function evalCondition(state: CombatState, content: Content, when: Condition, ctx: EffectContext): boolean {
  const target = ctx.targetId ? combatant(state, ctx.targetId) : null;
  if ('resourceAtLeast' in when) return state.hero.resources[when.resourceAtLeast] >= when.amount;
  if ('targetHas' in when) return !!target && getStatus(target.statuses, when.targetHas) > 0;
  if ('targetBelowHp' in when) return !!target && target.hp < target.maxHp * when.targetBelowHp;
  if ('heroBelowHp' in when) return state.hero.hp < state.hero.maxHp * when.heroBelowHp;
  if ('playedNoAttack' in when) return state.hero.turn.attacksPlayed === 0;
  if ('firstCardThisTurn' in when) return state.hero.turn.cardsPlayed === 0;
  if ('targetTag' in when) {
    if (!target || !isEnemy(target)) return false;
    return (content.enemies[target.enemyId]?.tags ?? []).includes(when.targetTag);
  }
  if ('flag' in when) return !!state.hero.flags[when.flag];
  return false;
}

// ---------------------------------------------------------------- targets

/**
 * Who an effect hits. Hero-side sources aim at enemies; enemy sources aim at
 * the hero. `all` is "all enemies" from either side (an enemy buffing its
 * pack), `random` is a random living enemy.
 */
export function resolveTargets(state: CombatState, target: Target | undefined, ctx: EffectContext, fallback: Target): string[] {
  const t = target ?? fallback;
  const enemySide = ctx.source.kind === 'enemy';
  switch (t) {
    case 'hero': return [HERO_ID];
    case 'companion': return state.hero.companion ? [COMPANION_ID] : [];
    case 'self': return enemySide ? [(ctx.source as { id: string }).id] : [HERO_ID];
    case 'target': {
      if (enemySide) return [HERO_ID];
      return ctx.targetId && enemy(state, ctx.targetId)?.alive ? [ctx.targetId] : [];
    }
    case 'all': return aliveEnemies(state).map((e) => e.id);
    case 'random': {
      const alive = aliveEnemies(state);
      return alive.length ? [state.rng.misc.pick(alive).id] : [];
    }
  }
}

// ---------------------------------------------------------------- resolver

function resolveOne(state: CombatState, content: Content, effect: AnyEffect, ctx: EffectContext): void {
  switch (effect.do) {
    case 'damage': {
      const times = effect.times ?? 1;
      for (let i = 0; i < times; i++) {
        for (const id of resolveTargets(state, effect.target, ctx, 'target')) {
          const target = combatant(state, id);
          if (!target || (isEnemy(target) && !target.alive)) continue;
          const base = evalAmount(state, effect.amount, { ...ctx, targetId: id });
          let amount = base;
          const src = ctx.source.kind;
          const attack = src === 'hero' || src === 'enemy' || src === 'companion';
          if (src === 'hero') amount = calcAttackDamage(base, state.hero.statuses, target.statuses);
          else if (src === 'enemy') {
            const attacker = enemy(state, ctx.source.kind === 'enemy' ? ctx.source.id : '');
            amount = attacker ? calcAttackDamage(base, attacker.statuses, target.statuses) : base;
          } else if (src === 'companion') {
            amount = getStatus(target.statuses, 'vulnerable') > 0 ? Math.floor(base * 1.5) : base;
          }
          // Mark: hero-side attacks against a marked enemy hit harder and eat a mark.
          const marked = attack && src !== 'enemy' && isEnemy(target) && getStatus(target.statuses, 'mark') > 0;
          if (marked) amount += MARK_BONUS + (state.hero.flags.trueshot ? 2 : 0);
          dealDamage(state, content, id, amount, { source: ctx.source, attack, tags: effect.tags });
          if (marked && target.alive) applyStatus(state, content, id, 'mark', -1);
        }
      }
      break;
    }
    case 'block': {
      const fallback: Target = ctx.source.kind === 'enemy' ? 'self' : 'hero';
      for (const id of resolveTargets(state, effect.target, ctx, fallback)) {
        const target = combatant(state, id);
        if (!target) continue;
        const base = evalAmount(state, effect.amount, ctx);
        const modified = ctx.source.kind === 'hero' || ctx.source.kind === 'enemy';
        gainBlock(state, target, modified ? calcBlock(base, target.statuses) : base);
      }
      break;
    }
    case 'status': {
      const amount = evalAmount(state, effect.amount, ctx);
      for (const id of resolveTargets(state, effect.target, ctx, 'target')) {
        if (id === COMPANION_ID) continue;
        applyStatus(state, content, id, effect.status, amount);
      }
      break;
    }
    case 'removeStatus': {
      for (const id of resolveTargets(state, effect.target, ctx, 'target')) removeStatus(state, id, effect.status);
      break;
    }
    case 'draw':
      drawCards(state, content, evalAmount(state, effect.amount, ctx));
      break;
    case 'energy':
      gainEnergy(state, evalAmount(state, effect.amount, ctx));
      break;
    case 'heal': {
      const amount = evalAmount(state, effect.amount, ctx);
      const fallback: Target = ctx.source.kind === 'enemy' ? 'self' : 'hero';
      for (const id of resolveTargets(state, effect.target, ctx, fallback)) {
        const target = combatant(state, id);
        if (target) heal(state, target, amount);
      }
      break;
    }
    case 'gold': {
      const delta = evalAmount(state, effect.amount, ctx);
      state.hero.gold = Math.max(0, state.hero.gold + delta);
      state.events.push({ t: 'gold', delta, total: state.hero.gold });
      break;
    }
    case 'resource':
      gainResource(state, content, effect.name, evalAmount(state, effect.amount, ctx));
      break;
    case 'spend': {
      const spent = state.hero.resources[effect.name];
      state.hero.resources[effect.name] = 0;
      state.events.push({ t: 'resource', name: effect.name, delta: -spent, total: 0 });
      enqueue(state, effect.then, { ...ctx, spent });
      break;
    }
    case 'exhaust':
    case 'discard': {
      const kind = effect.do;
      const hand = state.piles.hand;
      if (effect.from === 'hand') {
        for (const inst of [...hand]) moveFromHand(state, content, inst, kind);
      } else if (effect.from === 'random') {
        const n = Math.min(effect.count ?? 1, hand.length);
        const picks = state.rng.misc.shuffle([...hand]).slice(0, n);
        for (const inst of picks) moveFromHand(state, content, inst, kind);
      } else {
        const n = Math.min(effect.count ?? 1, hand.length);
        if (n > 0) {
          state.prompt = { kind, count: n, from: hand.map((c) => c.uid) };
          state.events.push({ t: 'prompt', kind, count: n });
        }
      }
      break;
    }
    case 'addCard': {
      const count = effect.count ?? 1;
      for (let i = 0; i < count; i++) {
        const inst = makeInstance(state, effect.card, effect.upgraded ?? false);
        if (effect.to === 'hand' && state.piles.hand.length < HAND_LIMIT) {
          state.piles.hand.push(inst);
          state.events.push({ t: 'cardMoved', uid: inst.uid, to: 'hand' });
        } else if (effect.to === 'draw') {
          const at = state.rng.shuffle.int(0, state.piles.draw.length);
          state.piles.draw.splice(at, 0, inst);
          state.events.push({ t: 'cardMoved', uid: inst.uid, to: 'draw' });
        } else {
          state.piles.discard.push(inst);
          state.events.push({ t: 'cardMoved', uid: inst.uid, to: 'discard' });
        }
      }
      break;
    }
    case 'trap': {
      const limit = TRAP_LIMIT + (state.hero.flags.trappersKit ? 1 : 0);
      const cardId = ctx.source.kind === 'hero' ? (ctx.source.cardId ?? 'trap') : 'trap';
      while (state.hero.traps.length >= limit) {
        const old = state.hero.traps.shift()!;
        state.events.push({ t: 'trap', uid: old.uid, cardId: old.cardId, state: 'replaced' });
      }
      const trap = { uid: state.nextUid++, cardId, trigger: effect.trigger, effects: effect.effects };
      state.hero.traps.push(trap);
      state.events.push({ t: 'trap', uid: trap.uid, cardId, state: 'armed' });
      break;
    }
    case 'companion': {
      const c = state.hero.companion;
      if (!c) break;
      if (effect.action === 'act') enqueue(state, [{ do: '_companionAct', bonus: effect.bonus ?? 0 }], ctx);
      else if (effect.action === 'enrage') {
        c.enraged = true;
        state.events.push({ t: 'companion', action: 'enrage' });
      } else if (effect.action === 'unstun' && c.stunned) {
        c.stunned = false;
        state.events.push({ t: 'companion', action: 'unstun' });
      }
      break;
    }
    case 'power': {
      const cardId = ctx.source.kind === 'hero' ? (ctx.source.cardId ?? 'power') : 'power';
      const name = effect.name ?? (cardId in content.cards ? content.cards[cardId]!.name : cardId);
      const power = { uid: state.nextUid++, cardId, name, trigger: effect.trigger, effects: effect.effects, counter: 0 };
      state.hero.powers.push(power);
      state.events.push({ t: 'power', uid: power.uid, cardId, state: 'added' });
      break;
    }
    case 'if':
      enqueue(state, evalCondition(state, content, effect.when, ctx) ? effect.then : (effect.else ?? []), ctx);
      break;
    case 'summon':
      summon(state, content, effect.enemy, effect.count ?? 1, effect.max ?? 5, ctx);
      break;
    case 'flag': {
      if (ctx.source.kind === 'enemy') {
        const e = enemy(state, ctx.source.id);
        if (e) e.flags[effect.name] = true;
      } else state.hero.flags[effect.name] = true;
      break;
    }
    case 'script': {
      const fn = scripts[effect.id];
      if (!fn) throw new Error(`unknown script ${effect.id}`);
      fn(state, content, ctx);
      break;
    }
    case '_finishCard':
      finishCard(state, content, effect.uid);
      break;
    case '_companionAct':
      companionAct(state, content, effect.bonus);
      break;
  }
}

// ---------------------------------------------------------------- helpers used by the resolver and by combat.ts

export function gainEnergy(state: CombatState, delta: number): void {
  if (delta === 0) return;
  state.hero.energy = Math.max(0, state.hero.energy + delta);
  state.events.push({ t: 'energy', delta, total: state.hero.energy });
}

export function gainResource(state: CombatState, content: Content, name: ResourceName, delta: number): void {
  if (delta === 0) return;
  const cap = RESOURCE_CAP[name] + (name === 'holyPower' && state.hero.flags.blessedBeads ? 1 : 0);
  const before = state.hero.resources[name];
  const after = Math.max(0, Math.min(cap, before + delta));
  if (after === before) return;
  state.hero.resources[name] = after;
  state.events.push({ t: 'resource', name, delta: after - before, total: after });
  if (after > before) triggerPowers(state, content, 'onResourceGain', { source: { kind: 'system' } });
}

/** Draw `n` cards, reshuffling the discard pile in when the draw pile runs dry. */
export function drawCards(state: CombatState, content: Content, n: number): CardInstance[] {
  const drawn: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    if (state.piles.hand.length >= HAND_LIMIT) break;
    if (state.piles.draw.length === 0) {
      if (state.piles.discard.length === 0) break;
      state.piles.draw = state.rng.shuffle.shuffle(state.piles.discard);
      state.piles.discard = [];
      state.events.push({ t: 'shuffle', count: state.piles.draw.length });
    }
    const inst = state.piles.draw.pop()!;
    state.piles.hand.push(inst);
    drawn.push(inst);
  }
  if (drawn.length) state.events.push({ t: 'draw', uids: drawn.map((c) => c.uid) });
  for (const inst of drawn) {
    const card = cardOf(content, inst);
    if (card.onDraw) enqueue(state, card.onDraw, { source: { kind: 'hero', cardUid: inst.uid, cardId: inst.cardId } });
  }
  return drawn;
}

export function moveFromHand(state: CombatState, content: Content, inst: CardInstance, to: 'discard' | 'exhaust'): void {
  const i = state.piles.hand.indexOf(inst);
  if (i < 0) return;
  state.piles.hand.splice(i, 1);
  inst.costThisTurn = null;
  inst.bound = false;
  state.piles[to].push(inst);
  state.events.push({ t: 'cardMoved', uid: inst.uid, to });
  if (to === 'exhaust') triggerPowers(state, content, 'onExhaust', { source: { kind: 'system' } });
}

/** Where a card goes after it resolves, and the counters and triggers that follow. */
function finishCard(state: CombatState, content: Content, uid: number): void {
  const inst = state.inPlay;
  if (!inst || inst.uid !== uid) return;
  state.inPlay = null;
  const card = cardOf(content, inst);
  inst.costThisTurn = null;
  if (card.type === 'power') {
    state.events.push({ t: 'cardMoved', uid, to: 'powers' });
  } else if (hasKeyword(card, 'exhaust')) {
    state.piles.exhaust.push(inst);
    state.events.push({ t: 'cardMoved', uid, to: 'exhaust' });
    triggerPowers(state, content, 'onExhaust', { source: { kind: 'system' } });
  } else {
    state.piles.discard.push(inst);
    state.events.push({ t: 'cardMoved', uid, to: 'discard' });
  }

  const t = state.hero.turn;
  t.cardsPlayed++;
  const ctx: EffectContext = { source: { kind: 'system' }, targetId: state.hero.turn.lastTargetId };
  triggerPowers(state, content, 'onCardPlayed', ctx);
  if (card.type === 'attack') {
    t.attacksPlayed++;
    triggerPowers(state, content, 'onAttackPlayed', ctx);
    if (card.tags?.includes('fire')) {
      t.fireAttacksPlayed++;
      triggerPowers(state, content, 'onFireAttack', ctx);
    }
  } else if (card.type === 'skill') {
    t.skillsPlayed++;
    triggerPowers(state, content, 'onSkillPlayed', ctx);
    for (const e of aliveEnemies(state)) {
      const enrage = getStatus(e.statuses, 'enrage');
      if (enrage > 0) applyStatus(state, content, e.id, 'strength', enrage);
    }
  }
}

export function triggerPowers(state: CombatState, content: Content, trigger: PowerTrigger, ctx: EffectContext): void {
  for (const p of [...state.hero.powers]) {
    if (p.trigger !== trigger) continue;
    state.events.push({ t: 'power', uid: p.uid, cardId: p.cardId, state: 'fired' });
    enqueue(state, p.effects, { ...ctx, source: { kind: 'power', uid: p.uid } });
  }
}

export function fireTraps(state: CombatState, content: Content, trigger: TrapTrigger, ctx: EffectContext): void {
  const firing = state.hero.traps.filter((t) => t.trigger === trigger);
  if (!firing.length) return;
  state.hero.traps = state.hero.traps.filter((t) => t.trigger !== trigger);
  for (const trap of firing) {
    state.events.push({ t: 'trap', uid: trap.uid, cardId: trap.cardId, state: 'fired' });
    enqueue(state, trap.effects, { ...ctx, source: { kind: 'trap', uid: trap.uid } });
  }
  runQueue(state, content);
}

/** What each companion does when it acts. */
export const COMPANION_ACTIONS: Record<string, { every?: number; effects: (bonus: number) => Effect[] }> = {
  wolf: { effects: (b) => [{ do: 'damage', amount: 5 + b, target: 'random' }] },
  bear: { effects: (b) => [{ do: 'block', amount: 5 + b, target: 'hero' }] },
  hawk: { effects: (b) => [{ do: 'damage', amount: 2 + b, target: 'random' }, { do: 'status', status: 'mark', amount: 1, target: 'random' }] },
  serpent: { effects: (b) => [{ do: 'status', status: 'poison', amount: 3 + b, target: 'random' }] },
  boar: { every: 2, effects: (b) => [{ do: 'damage', amount: 8 + b, target: 'random' }] },
};

function companionAct(state: CombatState, content: Content, bonus: number): void {
  const c = state.hero.companion;
  if (!c) return;
  if (c.stunned) {
    c.stunned = false;
    state.events.push({ t: 'companion', action: 'unstun' });
    return;
  }
  const def = COMPANION_ACTIONS[c.id];
  if (!def) return;
  c.turnsActed++;
  if (def.every && c.turnsActed % def.every !== 0) return;
  let total = bonus + c.bonus;
  if (c.enraged) {
    total += 3;
    c.enraged = false;
  }
  state.events.push({ t: 'companion', action: 'act' });
  enqueue(state, def.effects(total), { source: { kind: 'companion' } });
  runQueue(state, content);
}

function summon(state: CombatState, content: Content, enemyId: string, count: number, max: number, ctx: EffectContext): void {
  for (let i = 0; i < count; i++) {
    if (aliveEnemies(state).length >= max) return;
    const inst = spawnEnemy(state, content, enemyId);
    // Put a summoned enemy next to its summoner so the line-up reads right.
    if (ctx.source.kind === 'enemy') {
      const at = state.enemies.findIndex((e) => e.id === (ctx.source as { id: string }).id);
      state.enemies.splice(at + 1, 0, inst);
    } else state.enemies.push(inst);
    state.events.push({ t: 'summon', enemy: inst.id, enemyId });
  }
}

/** Build an enemy instance; the caller places it and picks its intent. */
export function spawnEnemy(state: CombatState, content: Content, enemyId: string): EnemyInstance {
  const def = content.enemies[enemyId];
  if (!def) throw new Error(`unknown enemy ${enemyId}`);
  const hp = state.rng.encounters.int(def.hp[0], def.hp[1]);
  const inst: EnemyInstance = {
    id: `e${state.nextUid++}`,
    enemyId,
    name: def.name,
    hp,
    maxHp: hp,
    block: 0,
    statuses: {},
    intent: null,
    history: [],
    usedOnce: [],
    flags: {},
    phase: -1,
    alive: true,
    memory: {},
  };
  for (const [k, v] of Object.entries(def.start ?? {})) inst.statuses[k as keyof typeof inst.statuses] = v;
  return inst;
}
