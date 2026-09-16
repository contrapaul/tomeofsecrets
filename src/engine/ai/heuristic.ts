import type { Effect } from '../../content/schema';
import { aliveEnemies, cardOf, endTurn, evalAmount, legalPlays, playCard, respondPrompt, type CombatState, type Content, type EffectContext } from '../rules';

/**
 * A deliberately simple player for the sim and for tests: block what is
 * coming, kill what can be killed, otherwise hit the biggest threat. It is
 * not meant to be good; it is meant to be the same every time.
 */

function incomingDamage(state: CombatState): number {
  let total = 0;
  for (const e of aliveEnemies(state)) if (e.intent?.damage) total += e.intent.damage * (e.intent.hits ?? 1);
  return total;
}

function sumEffects(state: CombatState, effects: Effect[], ctx: EffectContext, kind: 'damage' | 'block'): number {
  let total = 0;
  for (const ef of effects) {
    if (ef.do === kind) total += evalAmount(state, ef.amount, ctx) * (ef.do === 'damage' ? (ef.times ?? 1) : 1) * (ef.do === 'damage' && ef.target === 'all' ? aliveEnemies(state).length : 1);
    else if (ef.do === 'if') total += Math.max(sumEffects(state, ef.then, ctx, kind), sumEffects(state, ef.else ?? [], ctx, kind));
    else if (ef.do === 'spend') total += sumEffects(state, ef.then, { ...ctx, spent: state.hero.resources[ef.name] }, kind);
  }
  return total;
}

function score(state: CombatState, content: Content, uid: number, targetId?: string): number {
  const inst = state.piles.hand.find((c) => c.uid === uid)!;
  const card = cardOf(content, inst);
  const ctx: EffectContext = { source: { kind: 'hero', cardUid: uid, cardId: inst.cardId }, targetId };
  const need = Math.max(0, incomingDamage(state) - state.hero.block);
  const dmg = sumEffects(state, card.effects, ctx, 'damage');
  const blk = sumEffects(state, card.effects, ctx, 'block');
  let s = 0;
  if (targetId) {
    const e = aliveEnemies(state).find((x) => x.id === targetId)!;
    if (dmg >= e.hp + e.block) s += 40; // a kill
    s += Math.min(dmg, e.hp + e.block);
    if (e.intent?.kind === 'attack') s += 3;
  } else {
    s += dmg;
  }
  s += Math.min(blk, need) * 1.5 + Math.max(0, blk - need) * 0.2;
  if (card.type === 'power') s += state.turn <= 2 ? 12 : 4;
  for (const ef of card.effects) {
    if (ef.do === 'draw') s += 3;
    if (ef.do === 'status' && ef.target !== 'hero' && ef.target !== 'self') s += 4;
    if (ef.do === 'status' && (ef.status === 'strength' || ef.status === 'dexterity')) s += 6;
    if (ef.do === 'resource') s += 2;
    if (ef.do === 'trap') s += 5;
    if (ef.do === 'heal') s += state.hero.hp < state.hero.maxHp * 0.6 ? 6 : 0;
  }
  // Prefer to spend energy fully: cheap cards slightly ahead when the turn is nearly over.
  const cost = card.cost === 'X' ? state.hero.energy : card.cost;
  s -= cost * 0.5;
  return s;
}

/** Answer a prompt by giving up the worst cards. */
function worstCards(state: CombatState, content: Content, count: number, from: number[]): number[] {
  const ranked = from
    .map((uid) => state.piles.hand.find((c) => c.uid === uid)!)
    .filter(Boolean)
    .map((inst) => {
      const card = cardOf(content, inst);
      let badness = 0;
      if (card.type === 'status' || card.type === 'curse') badness += 100;
      badness += typeof card.cost === 'number' ? card.cost : 3;
      return { uid: inst.uid, badness };
    })
    .sort((a, b) => b.badness - a.badness);
  return ranked.slice(0, count).map((r) => r.uid);
}

/** Play one full hero turn, including any prompts, then end it. */
export function playTurn(state: CombatState, content: Content): void {
  let guard = 0;
  while (state.phase === 'player' && guard++ < 50) {
    if (state.prompt) {
      respondPrompt(state, content, worstCards(state, content, state.prompt.count, state.prompt.from));
      continue;
    }
    const plays = legalPlays(state, content);
    if (!plays.length) break;
    let best = plays[0]!;
    let bestScore = -Infinity;
    for (const p of plays) {
      const sc = score(state, content, p.uid, p.targetId);
      if (sc > bestScore) {
        bestScore = sc;
        best = p;
      }
    }
    if (bestScore < 0) break;
    const r = playCard(state, content, best.uid, best.targetId);
    if (!r.ok) break;
  }
  if (state.phase === 'player' && !state.prompt) endTurn(state, content);
}

export interface FightResult {
  won: boolean;
  turns: number;
  hpLost: number;
  hpLeft: number;
}

/** Play a fight to the end. `maxTurns` guards a stalemate. */
export function playFight(state: CombatState, content: Content, maxTurns = 40): FightResult {
  const startHp = state.hero.hp;
  while (state.phase === 'player' && state.turn <= maxTurns) playTurn(state, content);
  return { won: state.phase === 'won', turns: state.turn, hpLost: startHp - state.hero.hp, hpLeft: state.hero.hp };
}
