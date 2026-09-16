import { createStreams } from '../rng';
import { cardOf, costOf, hasKeyword, makeInstance, whyUnplayable, type Unplayable } from './cards';
import { aliveEnemies, HERO_ID } from './entities';
import { drawCards, enqueue, fireTraps, gainEnergy, moveFromHand, runQueue, spawnEnemy, triggerPowers } from './effects';
import { chooseIntent, refreshIntents, skipReason } from './intents';
import { applyStatus, dealDamage, decay, decayHeroRound, gainBlock, heal, loseHp, ROUND_DECAY, setStatusTo } from './mutate';
import { getStatus } from './statuses';
import type { CombatState, Content, EncounterSetup, EnemyInstance, HeroSetup } from './types';

export const DRAW_PER_TURN = 5;
export const BASE_ENERGY = 3;

// ---------------------------------------------------------------- setup

export function createCombat(content: Content, hero: HeroSetup, encounter: EncounterSetup, seed: string): CombatState {
  const state: CombatState = {
    seed,
    turn: 0,
    phase: 'player',
    hero: {
      classId: hero.classId,
      hp: hero.hp ?? hero.maxHp,
      maxHp: hero.maxHp,
      block: 0,
      energy: 0,
      maxEnergy: hero.maxEnergy ?? BASE_ENERGY,
      gold: hero.gold ?? 0,
      statuses: {},
      resources: { holyPower: hero.resources?.holyPower ?? 0, charge: hero.resources?.charge ?? 0 },
      powers: [],
      traps: [],
      companion: hero.companion ? { id: hero.companion, bonus: 0, stunned: false, enraged: false, turnsActed: 0 } : null,
      barricade: false,
      turn: freshTurn(),
      drawPenaltyNext: 0,
      energyPenaltyNext: 0,
      flags: {},
      fresh: [],
    },
    piles: { draw: [], hand: [], discard: [], exhaust: [] },
    inPlay: null,
    enemies: [],
    queue: [],
    prompt: null,
    events: [],
    nextUid: 1,
    rng: createStreams(seed),
  };

  for (const c of hero.deck) {
    if (!content.cards[c.cardId]) throw new Error(`unknown card ${c.cardId}`);
    state.piles.draw.push(makeInstance(state, c.cardId, c.upgraded ?? false));
  }
  state.rng.shuffle.shuffle(state.piles.draw);
  // Innate cards sit on top so the first draw finds them.
  const innate = state.piles.draw.filter((c) => hasKeyword(cardOf(content, c), 'innate'));
  state.piles.draw = [...state.piles.draw.filter((c) => !innate.includes(c)), ...innate];

  for (const id of encounter.enemies) state.enemies.push(spawnEnemy(state, content, id));
  state.events.push({ t: 'fightStart' });

  for (const c of state.piles.draw) {
    const card = cardOf(content, c);
    if (card.onFightStart) enqueue(state, card.onFightStart, { source: { kind: 'hero', cardUid: c.uid, cardId: c.cardId } });
  }
  runQueue(state, content);
  for (const e of state.enemies) chooseIntent(state, content, e);
  startHeroTurn(state, content);
  return state;
}

function freshTurn() {
  return { cardsPlayed: 0, attacksPlayed: 0, skillsPlayed: 0, fireAttacksPlayed: 0, damageTaken: 0, drawBonus: 0, lastTargetId: undefined };
}

// ---------------------------------------------------------------- hero turn

export function startHeroTurn(state: CombatState, content: Content): void {
  if (state.phase === 'won' || state.phase === 'lost') return;
  state.turn++;
  state.phase = 'player';
  const h = state.hero;
  h.turn = freshTurn();
  delete h.flags.enemyDiedThisTurn;
  state.events.push({ t: 'turnStart', turn: state.turn, side: 'hero' });

  if (h.barricade || h.flags.aegis) {
    h.barricade = false;
  } else if (h.block > 0) {
    h.block = 0;
    state.events.push({ t: 'block', target: HERO_ID, amount: 0, total: 0 });
  }

  const energy = Math.max(0, h.maxEnergy - h.energyPenaltyNext) + (state.turn === 1 && h.flags.quillOfHaste ? 1 : 0);
  h.energyPenaltyNext = 0;
  h.energy = 0;
  gainEnergy(state, energy);

  tickStartOfTurn(state, content, HERO_ID);
  if (state.phase !== 'player') return;

  const draws = Math.max(0, DRAW_PER_TURN + h.turn.drawBonus - h.drawPenaltyNext + (h.flags.aspectOfTheHawk ? 1 : 0));
  h.drawPenaltyNext = 0;
  drawCards(state, content, draws);
  if (h.companion && h.flags.bestialWrath) enqueue(state, [{ do: 'companion', action: 'act' }], { source: { kind: 'system' } });
  triggerPowers(state, content, 'startTurn', { source: { kind: 'system' } });
  runQueue(state, content);
  checkWin(state);
  refreshIntents(state, content);
}

/** Poison and Burn tick at the start of the holder's turn. */
function tickStartOfTurn(state: CombatState, content: Content, id: string): void {
  const target = id === HERO_ID ? state.hero : state.enemies.find((e) => e.id === id);
  if (!target) return;
  const poison = getStatus(target.statuses, 'poison');
  if (poison > 0) {
    loseHp(state, target, poison);
    setStatusTo(state, target, 'poison', poison - 1);
  }
  const burn = getStatus(target.statuses, 'burn');
  if (burn > 0) {
    dealDamage(state, content, id, burn, { source: { kind: 'system' }, attack: false });
    setStatusTo(state, target, 'burn', burn - 1);
  }
}

export type PlayResult = { ok: true } | { ok: false; reason: Unplayable };

export function playCard(state: CombatState, content: Content, uid: number, targetId?: string): PlayResult {
  const reason = whyUnplayable(state, content, uid, targetId);
  if (reason) return { ok: false, reason };
  const inst = state.piles.hand.find((c) => c.uid === uid)!;
  const card = cardOf(content, inst);
  const cost = costOf(state, inst, card);
  const x = card.cost === 'X' ? state.hero.energy : undefined;
  gainEnergy(state, -cost);

  state.piles.hand.splice(state.piles.hand.indexOf(inst), 1);
  state.inPlay = inst;
  const aimed = card.target === 'enemy' ? targetId : undefined;
  state.hero.turn.lastTargetId = aimed;
  state.events.push({ t: 'play', uid, cardId: inst.cardId, targetId: aimed });

  enqueue(state, [...card.effects, { do: '_finishCard', uid }], { source: { kind: 'hero', cardUid: uid, cardId: inst.cardId }, targetId: aimed, x });
  runQueue(state, content);
  checkWin(state);
  refreshIntents(state, content);
  return { ok: true };
}

/** Answer an open discard/exhaust prompt with the chosen hand cards. */
export function respondPrompt(state: CombatState, content: Content, uids: number[]): boolean {
  const p = state.prompt;
  if (!p) return false;
  const chosen = uids.filter((u) => p.from.includes(u)).slice(0, p.count);
  const unique = [...new Set(chosen)];
  if (unique.length !== Math.min(p.count, p.from.length)) return false;
  state.prompt = null;
  for (const u of unique) {
    const inst = state.piles.hand.find((c) => c.uid === u);
    if (inst) moveFromHand(state, content, inst, p.kind);
  }
  runQueue(state, content);
  checkWin(state);
  refreshIntents(state, content);
  return true;
}

export function endTurn(state: CombatState, content: Content): boolean {
  if (state.phase !== 'player' || state.prompt || state.inPlay) return false;
  const h = state.hero;

  triggerPowers(state, content, 'endTurn', { source: { kind: 'system' } });
  runQueue(state, content);

  // The hand: hooks first, then Ethereal exhausts, Retain stays, the rest discards.
  for (const inst of [...state.piles.hand]) {
    const card = cardOf(content, inst);
    if (card.onEndOfTurnInHand) enqueue(state, card.onEndOfTurnInHand, { source: { kind: 'hero', cardUid: inst.uid, cardId: inst.cardId } });
  }
  runQueue(state, content);
  let retained = 0;
  for (const inst of [...state.piles.hand]) {
    const card = cardOf(content, inst);
    if (hasKeyword(card, 'ethereal')) moveFromHand(state, content, inst, 'exhaust');
    else if (hasKeyword(card, 'retain') || h.flags.retainHand) continue;
    else if (h.flags.hourglass && retained < 1) retained++;
    else moveFromHand(state, content, inst, 'discard');
  }
  delete h.flags.retainHand;

  if (h.companion) enqueue(state, [{ do: 'companion', action: 'act' }], { source: { kind: 'system' } });
  runQueue(state, content);

  // Hero end-of-turn statuses.
  const regen = getStatus(h.statuses, 'regen');
  if (regen > 0) {
    heal(state, h, regen);
    setStatusTo(state, h, 'regen', regen - 1);
  }
  const plated = getStatus(h.statuses, 'platedArmor') + getStatus(h.statuses, 'metallicize');
  if (plated > 0) gainBlock(state, h, plated);

  if (checkWin(state)) return true;
  enemyTurn(state, content);
  if ((state.phase as string) === 'enemy') startHeroTurn(state, content);
  return true;
}

// ---------------------------------------------------------------- enemy turn

function enemyTurn(state: CombatState, content: Content): void {
  state.phase = 'enemy';
  state.events.push({ t: 'turnStart', turn: state.turn, side: 'enemy' });
  fireTraps(state, content, 'enemyTurnStart', { source: { kind: 'system' } });
  if (checkWin(state)) return;
  for (const e of [...state.enemies]) {
    if (!e.alive) continue;
    enemyAct(state, content, e);
    if (state.phase !== 'enemy') return;
  }
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const regen = getStatus(e.statuses, 'regen');
    if (regen > 0) {
      heal(state, e, regen);
      setStatusTo(state, e, 'regen', regen - 1);
    }
    const plated = getStatus(e.statuses, 'platedArmor') + getStatus(e.statuses, 'metallicize');
    if (plated > 0) gainBlock(state, e, plated);
    const ritual = getStatus(e.statuses, 'ritual');
    if (ritual > 0) applyStatus(state, content, e.id, 'strength', ritual);
    for (const s of ROUND_DECAY) decay(state, e, s);
  }
  decayHeroRound(state);
  for (const e of state.enemies) if (e.alive) chooseIntent(state, content, e);
  if (checkWin(state)) return;
  // Enemy block expires at the start of the hero's turn, StS-style.
  for (const e of state.enemies) {
    if (e.alive && e.block > 0) {
      e.block = 0;
      state.events.push({ t: 'block', target: e.id, amount: 0, total: 0 });
    }
  }
}

function enemyAct(state: CombatState, content: Content, e: EnemyInstance): void {
  tickStartOfTurn(state, content, e.id);
  if (!e.alive || state.phase !== 'enemy') return;
  const intent = e.intent;
  if (!intent) return;

  const skip = skipReason(e);
  if (skip) {
    if (skip === 'frozen') {
      setStatusTo(state, e, 'frozen', 0);
      setStatusTo(state, e, 'chill', 0);
    } else setStatusTo(state, e, skip, getStatus(e.statuses, skip) - 1);
    state.events.push({ t: 'enemyAct', enemy: e.id, move: intent.move, skipped: skip });
    if (skip !== 'wait') e.history.push(intent.move);
    return;
  }

  const def = content.enemies[e.enemyId]!;
  const move = def.moves[intent.move]!;
  const ctx = { source: { kind: 'enemy' as const, id: e.id }, targetId: HERO_ID };

  if (move.intent === 'attack') {
    fireTraps(state, content, 'enemyAttack', { source: { kind: 'system' }, targetId: e.id });
    if (!e.alive || state.phase !== 'enemy') return;
    triggerPowers(state, content, 'onEnemyAttack', { source: { kind: 'system' }, targetId: e.id });
    runQueue(state, content);
    if (!e.alive || state.phase !== 'enemy') return;
  } else if (move.intent === 'buff') {
    fireTraps(state, content, 'enemyBuff', { source: { kind: 'system' }, targetId: e.id });
    if (!e.alive || state.phase !== 'enemy') return;
    if (state.hero.flags.negateBuff) {
      delete state.hero.flags.negateBuff;
      state.events.push({ t: 'enemyAct', enemy: e.id, move: intent.move, skipped: 'countered' });
      e.history.push(intent.move);
      if (move.once) e.usedOnce.push(intent.move);
      return;
    }
  }

  state.events.push({ t: 'enemyAct', enemy: e.id, move: intent.move });
  enqueue(state, move.effects, ctx);
  runQueue(state, content);
  e.history.push(intent.move);
  if (move.once) e.usedOnce.push(intent.move);
  e.intent = null;
}

// ---------------------------------------------------------------- end of fight

function checkWin(state: CombatState): boolean {
  if (state.phase === 'won' || state.phase === 'lost') return true;
  if (aliveEnemies(state).length === 0) {
    state.phase = 'won';
    state.events.push({ t: 'end', result: 'won' });
    return true;
  }
  return false;
}

/** Take the pending presentation events and clear the queue. */
export function drainEvents(state: CombatState): CombatState['events'] {
  const out = state.events;
  state.events = [];
  return out;
}
