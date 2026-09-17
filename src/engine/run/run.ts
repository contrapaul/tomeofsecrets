import type { Card, ClassId, Effect } from '../../content/schema';
import { createStreams, restoreStreams, saveStreams, type StreamStates, type Streams } from '../rng';
import { createCombat, setHooks, type CombatState, type CompanionId, type Content, type HeroSetup } from '../rules';
import { findNode, generateMap, reachable, type MapNode, type RunMap } from './map';
import { knownEvents, registerEvents, resumeAfterFight, startDialogue, type DialogueState } from './events';
import { offerCards, rollBossRelics, rollGold, rollRelic, rollVial } from './rewards';

/**
 * A run: the hero between fights, the map, and whichever screen is open.
 * Pure. The UI calls these and saves the result after every one.
 */

export interface DeckCard {
  uid: number;
  cardId: string;
  upgraded: boolean;
}

export interface RunHero {
  classId: ClassId;
  hp: number;
  maxHp: number;
  gold: number;
  deck: DeckCard[];
  relics: string[];
  /** Once-per-run relics that have fired. */
  relicsUsed: string[];
  vials: string[];
  vialSlots: number;
  maxEnergy: number;
  companion?: CompanionId;
}

export type RunPhase = 'map' | 'fight' | 'reward' | 'shop' | 'camp' | 'event' | 'treasure' | 'bossReward' | 'won' | 'lost';

export interface RewardState {
  kind: 'fight' | 'elite' | 'boss';
  gold: number;
  goldTaken: boolean;
  cards: string[];
  cardTaken: boolean;
  relic: string | null;
  relicTaken: boolean;
  vial: string | null;
  vialTaken: boolean;
}

export interface ShopItem {
  id: string;
  price: number;
  sold: boolean;
}

export interface ShopState {
  cards: ShopItem[];
  relics: ShopItem[];
  vials: ShopItem[];
  removalPrice: number;
  removed: boolean;
}

export interface RunStats {
  fights: number;
  elites: number;
  bosses: number;
  damageDealt: number;
  damageTaken: number;
  cardsPlayed: Record<string, number>;
  kills: Record<string, number>;
  deathBy?: { enemy: string; move: string };
  floorsClimbed: number;
}

export interface RunState {
  version: 1;
  seed: string;
  startedAt: string;
  hero: RunHero;
  chapter: 1 | 2 | 3;
  map: RunMap;
  position: string | null;
  visited: string[];
  phase: RunPhase;
  fight: { encounter: string[]; kind: 'fight' | 'elite' | 'boss'; state: CombatState; fromEvent?: boolean } | null;
  reward: RewardState | null;
  shop: ShopState | null;
  treasure: { relics: string[]; taken: boolean } | null;
  bossRelics: string[] | null;
  camp: { used: boolean } | null;
  event: { file: string; state: DialogueState } | null;
  /** Story and event memory: `> flag set` writes here. */
  flags?: Record<string, boolean>;
  eventsSeen?: string[];
  /** Where the reward screen leads: back to an event's script, or the map. */
  afterReward?: 'map' | 'event';
  /** Encounter groups used this chapter, so fights do not repeat. */
  used: string[];
  fightsThisChapter: number;
  rarePity: number;
  /** Card removals bought this run; the price climbs with each. */
  removals: number;
  stats: RunStats;
  nextUid: number;
  rng: Streams;
}

export interface RunSetup {
  classId: ClassId;
  seed: string;
}

// ---------------------------------------------------------------- creation and save

export function createRun(content: Content, setup: RunSetup): RunState {
  if (content.events) registerEvents(content.events);
  const cls = content.classes?.[setup.classId];
  if (!cls) throw new Error(`unknown class ${setup.classId}`);
  const rng = createStreams(setup.seed);
  let uid = 1;
  const run: RunState = {
    version: 1,
    seed: setup.seed,
    startedAt: new Date().toISOString(),
    hero: {
      classId: setup.classId,
      hp: cls.hp,
      maxHp: cls.hp,
      gold: 99,
      deck: cls.starter.map((cardId) => ({ uid: uid++, cardId, upgraded: false })),
      relics: [],
      relicsUsed: [],
      vials: [],
      vialSlots: 3,
      maxEnergy: 3,
      companion: cls.companion,
    },
    chapter: 1,
    map: generateMap(rng.map, 1),
    position: null,
    visited: [],
    phase: 'map',
    fight: null,
    reward: null,
    shop: null,
    treasure: null,
    bossRelics: null,
    camp: null,
    event: null,
    used: [],
    fightsThisChapter: 0,
    rarePity: 0,
    removals: 0,
    stats: { fights: 0, elites: 0, bosses: 0, damageDealt: 0, damageTaken: 0, cardsPlayed: {}, kills: {}, floorsClimbed: 0 },
    nextUid: uid,
    rng,
  };
  const starter = Object.values(content.relics ?? {}).find((r) => r.tier === 'starter' && r.class === setup.classId);
  if (starter) addRelic(run, content, starter.id);
  return run;
}

/** JSON-safe copy. The combat state's RNG serialises itself. */
export function serializeRun(run: RunState): unknown {
  return { ...run, rng: saveStreams(run.rng) };
}

export function reviveRun(content: Content, data: unknown): RunState {
  const raw = data as Omit<RunState, 'rng'> & { rng: StreamStates };
  if (!raw || raw.version !== 1) throw new Error('unknown save version');
  if (content.events) registerEvents(content.events);
  const run: RunState = { ...raw, rng: restoreStreams(raw.rng) };
  if (run.fight) {
    const fs = run.fight.state as unknown as Omit<CombatState, 'rng'> & { rng: StreamStates };
    run.fight.state = { ...fs, rng: restoreStreams(fs.rng) } as CombatState;
    setHooks(combatHooks(run, content));
  }
  return run;
}

// ---------------------------------------------------------------- relics

export function addRelic(run: RunState, content: Content, id: string): void {
  const relic = content.relics?.[id];
  if (!relic || run.hero.relics.includes(id)) return;
  run.hero.relics.push(id);
  const r = relic.run;
  if (r?.maxHp) {
    run.hero.maxHp += r.maxHp;
    run.hero.hp += r.maxHp;
  }
  if (r?.energy) run.hero.maxEnergy += r.energy;
  if (r?.vialSlots) run.hero.vialSlots += r.vialSlots;
  if (r?.upgradeRandomAttacks) {
    const attacks = run.rng.rewards.shuffle(run.hero.deck.filter((c) => !c.upgraded && content.cards[c.cardId]?.type === 'attack'));
    for (const c of attacks.slice(0, r.upgradeRandomAttacks)) c.upgraded = true;
  }
  if (id === 'fresh-pages') {
    for (const c of run.hero.deck) {
      const def = content.cards[c.cardId];
      if (def?.rarity === 'starter' && (def.type === 'attack' || def.type === 'skill')) c.cardId = randomClassCard(run, content);
    }
  }
}

function randomClassCard(run: RunState, content: Content): string {
  const pool = Object.values(content.cards).filter((c) => c.class === run.hero.classId && c.rarity !== 'starter');
  return run.rng.rewards.pick(pool).id;
}

function relicsOf(run: RunState, content: Content) {
  return run.hero.relics.map((id) => content.relics?.[id]).filter((r): r is NonNullable<typeof r> => !!r);
}

/** Merge every held relic's in-fight behaviour into the hooks the engine takes. */
export function combatHooks(run: RunState, content: Content): NonNullable<HeroSetup['hooks']> & { resources: Partial<Record<'holyPower' | 'charge', number>> } {
  const flags: string[] = [];
  const fightStart: Effect[] = [];
  const turnStart: Effect[] = [];
  const resources: Partial<Record<'holyPower' | 'charge', number>> = {};
  for (const relic of relicsOf(run, content)) {
    const c = relic.combat;
    if (!c) continue;
    if (relic.run?.oncePerRun && run.hero.relicsUsed.includes(relic.id)) continue;
    flags.push(...(c.flags ?? []));
    fightStart.push(...(c.fightStart ?? []));
    turnStart.push(...(c.turnStart ?? []));
    if (c.resource) resources[c.resource.name] = (resources[c.resource.name] ?? 0) + c.resource.amount;
  }
  if (run.hero.vials.includes('phoenix-feather')) flags.push('reviveOnce');
  return { flags, fightStart, turnStart, resources };
}

// ---------------------------------------------------------------- the map

export function availableNodes(run: RunState): MapNode[] {
  return run.phase === 'map' ? reachable(run.map, run.position) : [];
}

export function enterNode(run: RunState, content: Content, nodeId: string): void {
  if (run.phase !== 'map') return;
  const node = findNode(run.map, nodeId);
  if (!node || !availableNodes(run).some((n) => n.id === nodeId)) return;
  run.position = nodeId;
  run.visited.push(nodeId);
  run.stats.floorsClimbed = Math.max(run.stats.floorsClimbed, node.floor);
  let type = node.type;
  if (type === 'unknown') {
    type = run.rng.events.weighted(['event', 'fight', 'merchant', 'treasure'] as const, [55, 25, 10, 10]);
    if (type === 'fight' && node.floor <= 3) type = 'event';
  }
  switch (type) {
    case 'fight': return startFight(run, content, 'fight');
    case 'elite': return startFight(run, content, 'elite');
    case 'boss': return startFight(run, content, 'boss');
    case 'merchant': return openShop(run, content);
    case 'camp':
      run.camp = { used: false };
      run.phase = 'camp';
      return;
    case 'treasure': {
      const choices = relicsOf(run, content).reduce((n, r) => n + (r.run?.treasureChoices ?? 0), 0) || 1;
      const relics: string[] = [];
      for (let i = 0; i < choices; i++) {
        const r = rollRelic(run.rng.rewards, content, run.hero.classId, 'treasure', [...run.hero.relics, ...relics]);
        if (r) relics.push(r);
      }
      run.treasure = { relics, taken: false };
      run.phase = 'treasure';
      return;
    }
    case 'event': {
      const file = pickEvent(run);
      run.phase = 'event';
      startDialogue(run, content, file);
      return;
    }
  }
}

/** A random event this run has not seen, from the registered scripts. */
function pickEvent(run: RunState): string {
  const all = knownEvents();
  if (!all.length) throw new Error('no events registered');
  run.eventsSeen ??= [];
  const fresh = all.filter((f) => !run.eventsSeen!.includes(f));
  const file = run.rng.events.pick(fresh.length ? fresh : all);
  run.eventsSeen.push(file);
  return file;
}

// ---------------------------------------------------------------- fights

function pickEncounter(run: RunState, content: Content, kind: 'fight' | 'elite' | 'boss'): string[] {
  const pools = content.encounters?.[run.chapter];
  if (!pools) throw new Error(`no encounters for chapter ${run.chapter}`);
  const pool = kind === 'boss' ? pools.boss : kind === 'elite' ? pools.elite : run.fightsThisChapter < 3 ? pools.easy : pools.normal;
  const fresh = pool.filter((g) => !run.used.includes(g.join('+')));
  const group = run.rng.encounters.pick(fresh.length ? fresh : pool);
  run.used.push(group.join('+'));
  return [...group];
}

export function startFight(run: RunState, content: Content, kind: 'fight' | 'elite' | 'boss', encounter?: string[], fromEvent = false): void {
  const enemies = encounter ?? pickEncounter(run, content, kind);
  const hooks = combatHooks(run, content);
  setHooks(hooks);
  const setup: HeroSetup = {
    classId: run.hero.classId,
    maxHp: run.hero.maxHp,
    hp: run.hero.hp,
    gold: run.hero.gold,
    deck: run.hero.deck.map((c) => ({ cardId: c.cardId, upgraded: c.upgraded })),
    companion: run.hero.companion,
    maxEnergy: run.hero.maxEnergy,
    vials: run.hero.vials,
    vialSlots: run.hero.vialSlots,
    relics: run.hero.relics,
    resources: hooks.resources,
    hooks,
  };
  const seed = `${run.seed}:${run.chapter}:${run.visited.length}:${enemies.join('+')}`;
  const state = createCombat(content, setup, { enemies }, seed);
  run.fight = { encounter: enemies, kind, state, fromEvent };
  run.phase = 'fight';
  if (kind === 'fight') run.fightsThisChapter++;
}

/** Called once the combat state reports won or lost. Applies the fight's outcome to the run. */
export function finishFight(run: RunState, content: Content): void {
  const f = run.fight;
  if (!f) return;
  const s = f.state;
  run.hero.hp = s.hero.hp;
  run.hero.gold = s.hero.gold;
  run.hero.vials = [...s.hero.vials];
  if (s.hero.relics.includes('phylactery') && !s.hero.flags.reviveOnce && !run.hero.relicsUsed.includes('phylactery')) run.hero.relicsUsed.push('phylactery');
  if (run.hero.vials.includes('phoenix-feather') && !s.hero.flags.reviveOnce) run.hero.vials = run.hero.vials.filter((v) => v !== 'phoenix-feather');
  for (const e of s.enemies) if (!e.alive) run.stats.kills[e.enemyId] = (run.stats.kills[e.enemyId] ?? 0) + 1;
  if (s.phase === 'lost') {
    run.phase = 'lost';
    const killer = s.enemies.find((e) => e.alive && e.history.length);
    if (killer) run.stats.deathBy = { enemy: killer.enemyId, move: killer.history[killer.history.length - 1] ?? '' };
    run.fight = null;
    return;
  }
  run.stats.fights++;
  if (f.kind === 'elite') run.stats.elites++;
  if (f.kind === 'boss') run.stats.bosses++;
  const relics = relicsOf(run, content);
  const goldMult = relics.reduce((m, r) => m * (r.run?.goldMult ?? 1), 1);
  const goldAfter = relics.reduce((n, r) => n + (r.run?.goldAfterFight ?? 0), 0);
  const healAfter = relics.reduce((n, r) => n + (r.run?.healAfterFight ?? 0), 0);
  if (healAfter) run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + healAfter);
  const offer = offerCards(run.rng.rewards, content, run.hero.classId, f.kind, run.rarePity);
  run.rarePity = offer.pity;
  const doubled = f.fromEvent && run.event?.state.fightReward === 'double' ? 2 : 1;
  run.reward = {
    kind: f.kind,
    gold: rollGold(run.rng.rewards, f.kind, goldMult) * doubled + goldAfter,
    goldTaken: false,
    cards: offer.cards,
    cardTaken: false,
    relic: f.kind === 'elite' || doubled === 2 ? rollRelic(run.rng.rewards, content, run.hero.classId, 'elite', run.hero.relics) : null,
    relicTaken: false,
    vial: run.rng.rewards.chance(f.kind === 'fight' ? 0.25 : 0.4) ? rollVial(run.rng.rewards, content) : null,
    vialTaken: false,
  };
  if (f.kind === 'boss') {
    run.bossRelics = rollBossRelics(run.rng.rewards, content, run.hero.classId, run.hero.relics);
    run.hero.hp = run.hero.maxHp;
  }
  run.afterReward = f.fromEvent ? 'event' : 'map';
  run.fight = null;
  run.phase = 'reward';
}

// ---------------------------------------------------------------- rewards

export function takeGold(run: RunState): void {
  const r = run.reward;
  if (!r || r.goldTaken) return;
  run.hero.gold += r.gold;
  r.goldTaken = true;
}

export function takeCard(run: RunState, content: Content, cardId: string): void {
  const r = run.reward;
  if (!r || r.cardTaken || !r.cards.includes(cardId) || !content.cards[cardId]) return;
  run.hero.deck.push({ uid: run.nextUid++, cardId, upgraded: false });
  r.cardTaken = true;
}

export function skipCard(run: RunState): void {
  if (run.reward) run.reward.cardTaken = true;
}

export function takeRewardRelic(run: RunState, content: Content): void {
  const r = run.reward;
  if (!r || !r.relic || r.relicTaken) return;
  addRelic(run, content, r.relic);
  r.relicTaken = true;
}

export function takeVial(run: RunState): boolean {
  const r = run.reward;
  if (!r || !r.vial || r.vialTaken) return false;
  if (run.hero.vials.length >= run.hero.vialSlots) return false;
  run.hero.vials.push(r.vial);
  r.vialTaken = true;
  return true;
}

export function discardVial(run: RunState, index: number): void {
  run.hero.vials.splice(index, 1);
}

/** Leave the reward screen. Anything untaken is forfeited (gold is always taken). */
export function finishReward(run: RunState, content: Content): void {
  if (run.phase !== 'reward') return;
  takeGold(run);
  run.reward = null;
  if (run.bossRelics) {
    run.phase = 'bossReward';
    return;
  }
  if (run.afterReward === 'event' && run.event) {
    run.afterReward = undefined;
    run.phase = 'event';
    resumeAfterFight(run, content);
    return;
  }
  run.phase = 'map';
}

export function takeBossRelic(run: RunState, content: Content, id: string): void {
  if (run.phase !== 'bossReward' || !run.bossRelics?.includes(id)) return;
  addRelic(run, content, id);
  run.bossRelics = null;
  // Chapter 1 is the whole run until Phase 7 adds the rest.
  run.phase = 'won';
}

// ---------------------------------------------------------------- shop

const CARD_PRICE = { common: [45, 55], uncommon: [68, 82], rare: [135, 165] } as const;
const RELIC_PRICE = { common: [143, 157], uncommon: [238, 262], rare: [285, 315] } as const;
const VIAL_PRICE = { common: [48, 52], uncommon: [72, 78], rare: [95, 105] } as const;

function priceIn(run: RunState, content: Content, range: readonly [number, number]): number {
  const mult = relicsOf(run, content).reduce((m, r) => m * (r.run?.shopMult ?? 1), 1);
  return Math.round(run.rng.shop.int(range[0], range[1]) * mult);
}

export function openShop(run: RunState, content: Content): void {
  const rng = run.rng.shop;
  const cards: ShopItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const neutral = i === 4;
    const rarity = rng.weighted(['common', 'uncommon', 'rare'] as const, [55, 35, 10]);
    const pool = Object.values(content.cards).filter((c: Card) => c.rarity === rarity && (neutral ? c.class === 'neutral' : c.class === run.hero.classId) && !seen.has(c.id));
    if (!pool.length) continue;
    const card = rng.pick(pool);
    seen.add(card.id);
    cards.push({ id: card.id, price: priceIn(run, content, CARD_PRICE[rarity]), sold: false });
  }
  const relics: ShopItem[] = [];
  const owned = [...run.hero.relics];
  for (const tier of ['common', 'uncommon', 'rare'] as const) {
    const r = rollRelic(rng, content, run.hero.classId, tier === 'rare' ? 'elite' : 'treasure', owned);
    const relic = r ? content.relics?.[r] : undefined;
    if (!relic) continue;
    owned.push(relic.id);
    relics.push({ id: relic.id, price: priceIn(run, content, RELIC_PRICE[relic.tier === 'boss' || relic.tier === 'starter' ? 'rare' : relic.tier]), sold: false });
  }
  const vials: ShopItem[] = [];
  for (let i = 0; i < 3; i++) {
    const v = rollVial(rng, content);
    const vial = v ? content.vials?.[v] : undefined;
    if (!vial || vials.some((x) => x.id === vial.id)) continue;
    vials.push({ id: vial.id, price: priceIn(run, content, VIAL_PRICE[vial.rarity]), sold: false });
  }
  const sale = cards[rng.int(0, Math.max(0, cards.length - 1))];
  if (sale) sale.price = Math.round(sale.price / 2);
  run.shop = { cards, relics, vials, removalPrice: 75 + 25 * run.removals, removed: false };
  run.phase = 'shop';
}

export function buy(run: RunState, content: Content, kind: 'cards' | 'relics' | 'vials', index: number): boolean {
  const shop = run.shop;
  const item = shop?.[kind][index];
  if (!shop || !item || item.sold || run.hero.gold < item.price) return false;
  if (kind === 'vials' && run.hero.vials.length >= run.hero.vialSlots) return false;
  run.hero.gold -= item.price;
  item.sold = true;
  if (kind === 'cards') run.hero.deck.push({ uid: run.nextUid++, cardId: item.id, upgraded: false });
  else if (kind === 'relics') addRelic(run, content, item.id);
  else run.hero.vials.push(item.id);
  return true;
}

export function removeCard(run: RunState, uid: number): boolean {
  const shop = run.shop;
  if (!shop || shop.removed || run.hero.gold < shop.removalPrice) return false;
  const i = run.hero.deck.findIndex((c) => c.uid === uid);
  if (i < 0 || run.hero.deck.length <= 5) return false;
  run.hero.gold -= shop.removalPrice;
  run.hero.deck.splice(i, 1);
  shop.removed = true;
  run.removals++;
  return true;
}

export function leaveShop(run: RunState): void {
  if (run.phase !== 'shop') return;
  run.shop = null;
  run.phase = 'map';
}

// ---------------------------------------------------------------- camp and treasure

export function canRest(run: RunState): boolean {
  return !run.hero.relics.includes('cursed-tome');
}

export function rest(run: RunState, content: Content): boolean {
  if (run.phase !== 'camp' || !run.camp || run.camp.used || !canRest(run)) return false;
  const bonus = relicsOf(run, content).reduce((n, r) => n + (r.run?.restBonus ?? 0), 0);
  run.hero.hp = Math.min(run.hero.maxHp, run.hero.hp + Math.round(run.hero.maxHp * (0.3 + bonus)));
  run.camp.used = true;
  return true;
}

export function smithUpgrades(run: RunState, content: Content): number {
  return Math.max(1, relicsOf(run, content).reduce((n, r) => Math.max(n, r.run?.smithUpgrades ?? 0), 0));
}

export function smith(run: RunState, content: Content, uids: number[]): boolean {
  if (run.phase !== 'camp' || !run.camp || run.camp.used) return false;
  const allowed = smithUpgrades(run, content);
  const cards = uids.slice(0, allowed).map((u) => run.hero.deck.find((c) => c.uid === u)).filter((c): c is DeckCard => !!c && !c.upgraded);
  if (!cards.length) return false;
  for (const c of cards) c.upgraded = true;
  run.camp.used = true;
  return true;
}

export function leaveCamp(run: RunState): void {
  if (run.phase !== 'camp') return;
  run.camp = null;
  run.phase = 'map';
}

export function takeTreasure(run: RunState, content: Content, id: string): void {
  const t = run.treasure;
  if (run.phase !== 'treasure' || !t || t.taken || !t.relics.includes(id)) return;
  addRelic(run, content, id);
  t.taken = true;
}

export function leaveTreasure(run: RunState): void {
  if (run.phase !== 'treasure') return;
  run.treasure = null;
  run.phase = 'map';
}

/** The script has ended (or the player is done reading). */
export function leaveEvent(run: RunState): void {
  if (run.phase !== 'event') return;
  run.event = null;
  run.phase = 'map';
}

export function abandon(run: RunState): void {
  run.phase = 'lost';
  run.fight = null;
}

/** Deck cards that can still be upgraded. */
export function upgradeable(run: RunState): DeckCard[] {
  return run.hero.deck.filter((c) => !c.upgraded);
}
