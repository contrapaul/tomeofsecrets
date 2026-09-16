import type { Card, Effect, Keyword } from '../../content/schema';
import { aliveEnemies, enemy } from './entities';
import { evalCondition } from './effects';
import type { CardInstance, CombatState, Content } from './types';

/** The card as it plays: base merged with its upgrade. */
export interface ResolvedCard {
  id: string;
  name: string;
  cost: number | 'X';
  effects: Effect[];
  keywords: Keyword[];
  text: string | undefined;
  type: Card['type'];
  target: Card['target'];
  tags: Card['tags'];
  playableIf: Card['playableIf'];
  costIf: Card['costIf'];
  onDraw: Effect[] | undefined;
  onEndOfTurnInHand: Effect[] | undefined;
  onFightStart: Effect[] | undefined;
}

export function resolveCard(card: Card, upgraded: boolean): ResolvedCard {
  const u = upgraded ? card.upgrade : {};
  return {
    id: card.id,
    name: upgraded ? (u.name ?? `${card.name}+`) : card.name,
    cost: u.cost ?? card.cost,
    effects: u.effects ?? card.effects,
    keywords: u.keywords ?? card.keywords ?? [],
    text: u.text ?? card.text,
    type: card.type,
    target: card.target,
    tags: card.tags,
    playableIf: card.playableIf,
    costIf: card.costIf,
    onDraw: card.onDraw,
    onEndOfTurnInHand: card.onEndOfTurnInHand,
    onFightStart: card.onFightStart,
  };
}

export function cardOf(content: Content, inst: CardInstance): ResolvedCard {
  const def = content.cards[inst.cardId];
  if (!def) throw new Error(`unknown card ${inst.cardId}`);
  return resolveCard(def, inst.upgraded);
}

export function makeInstance(state: CombatState, cardId: string, upgraded = false): CardInstance {
  return { uid: state.nextUid++, cardId, upgraded, costThisTurn: null, bound: false };
}

export function hasKeyword(card: ResolvedCard, k: Keyword): boolean {
  return card.keywords.includes(k);
}

/** The energy this card costs right now. X costs everything you have. */
export function costOf(state: CombatState, inst: CardInstance, card: ResolvedCard, content?: Content, targetId?: string): number {
  if (card.cost === 'X') return state.hero.energy;
  if (inst.costThisTurn !== null) return inst.costThisTurn;
  let c = card.cost;
  if (card.costIf && content && evalCondition(state, content, card.costIf.when, { source: { kind: 'hero', cardUid: inst.uid, cardId: inst.cardId }, targetId })) c = card.costIf.cost;
  if (card.type === 'power' && state.hero.flags.scholarsCap) c = Math.max(0, c - 1);
  return c;
}

export type Unplayable =
  | 'not-your-turn'
  | 'prompt-open'
  | 'resolving'
  | 'not-in-hand'
  | 'unplayable'
  | 'bound'
  | 'energy'
  | 'needs-target'
  | 'bad-target'
  | 'condition';

/** Why a card cannot be played right now, or null if it can. */
export function whyUnplayable(state: CombatState, content: Content, uid: number, targetId?: string): Unplayable | null {
  if (state.phase !== 'player') return 'not-your-turn';
  if (state.prompt) return 'prompt-open';
  if (state.inPlay) return 'resolving';
  const inst = state.piles.hand.find((c) => c.uid === uid);
  if (!inst) return 'not-in-hand';
  const card = cardOf(content, inst);
  if (hasKeyword(card, 'unplayable')) return 'unplayable';
  if (inst.bound) return 'bound';
  if (card.target === 'enemy') {
    if (!targetId) return 'needs-target';
    const e = enemy(state, targetId);
    if (!e || !e.alive) return 'bad-target';
    if (card.playableIf === 'targetBelowHalf' && e.hp * 2 >= e.maxHp) return 'condition';
  }
  if (costOf(state, inst, card, content, targetId) > state.hero.energy) return 'energy';
  if (card.playableIf === 'firstCardThisTurn' && state.hero.turn.cardsPlayed > 0) return 'condition';
  return null;
}

/** Every legal (uid, target) pair; what a heuristic player or the keyboard iterates. */
export function legalPlays(state: CombatState, content: Content): { uid: number; targetId?: string }[] {
  const out: { uid: number; targetId?: string }[] = [];
  for (const inst of state.piles.hand) {
    const card = cardOf(content, inst);
    if (card.target === 'enemy') {
      for (const e of aliveEnemies(state)) if (!whyUnplayable(state, content, inst.uid, e.id)) out.push({ uid: inst.uid, targetId: e.id });
    } else if (!whyUnplayable(state, content, inst.uid)) {
      out.push({ uid: inst.uid });
    }
  }
  return out;
}
