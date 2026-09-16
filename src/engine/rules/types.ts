import type { Card, ClassDef, ClassId, Enemy, IntentKind, PowerTrigger, ResourceName, StatusId, TrapTrigger } from '../../content/schema';
import type { Effect } from '../../content/schema';
import type { Streams } from '../rng';
import type { CombatEvent } from '../events';

export type StatusMap = Partial<Record<StatusId, number>>;

export interface CardInstance {
  uid: number;
  cardId: string;
  upgraded: boolean;
  /** Set by Delay / Presence of Mind for the current turn; null means the printed cost. */
  costThisTurn: number | null;
  /** The Binder's Bind: unplayable until the hero takes HP damage. */
  bound: boolean;
}

export interface PowerInstance {
  uid: number;
  /** The card that made it, for the UI. */
  cardId: string;
  name: string;
  trigger: PowerTrigger;
  effects: Effect[];
  /** Hot Streak style counters live here. */
  counter: number;
}

export interface TrapInstance {
  uid: number;
  cardId: string;
  trigger: TrapTrigger;
  effects: Effect[];
}

export type CompanionId = 'wolf' | 'bear' | 'hawk' | 'serpent' | 'boar';

export interface CompanionState {
  id: CompanionId;
  /** Permanent (this fight) bonus damage, from Feed. */
  bonus: number;
  stunned: boolean;
  enraged: boolean;
  /** Boar acts every other turn. */
  turnsActed: number;
}

export interface HeroState {
  classId: ClassId;
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  statuses: StatusMap;
  resources: Record<ResourceName, number>;
  powers: PowerInstance[];
  traps: TrapInstance[];
  companion: CompanionState | null;
  /** Block survives the start of turn (Aegis, Sacred Duty). Cleared when it applies. */
  barricade: boolean;
  /** Per-turn counters, reset at start of turn. */
  turn: {
    cardsPlayed: number;
    attacksPlayed: number;
    skillsPlayed: number;
    fireAttacksPlayed: number;
    damageTaken: number;
    drawBonus: number;
    /** The enemy the last played card aimed at, for powers that say "the target". */
    lastTargetId: string | undefined;
  };
  /** Draw-fewer-next-turn (Bind, Undertow). */
  drawPenaltyNext: number;
  energyPenaltyNext: number;
  /** Named flags set by `flag` effects and scripts. */
  flags: Record<string, boolean>;
  /**
   * Debuffs an enemy applied during its own turn. They skip the end-of-round
   * decay once, so "Weak 1" from an enemy actually weakens your next turn.
   */
  fresh: StatusId[];
}

export interface Intent {
  move: string;
  kind: IntentKind;
  hidden: boolean;
  /** Preview numbers, computed with the same maths as resolution. */
  damage?: number;
  hits?: number;
  block?: number;
}

export interface EnemyInstance {
  /** Unique within the fight. */
  id: string;
  enemyId: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  intent: Intent | null;
  history: string[];
  usedOnce: string[];
  flags: Record<string, boolean>;
  /** Index into `phases` currently active, or -1. */
  phase: number;
  alive: boolean;
  /** A stolen card or a reflected amount, for the few enemies that need memory. */
  memory: Record<string, unknown>;
}

export type Prompt =
  | { kind: 'discard'; count: number; from: number[] }
  | { kind: 'exhaust'; count: number; from: number[] };

export interface EffectContext {
  source: { kind: 'hero'; cardUid?: number; cardId?: string } | { kind: 'enemy'; id: string } | { kind: 'companion' } | { kind: 'trap'; uid: number } | { kind: 'power'; uid: number } | { kind: 'system' };
  /** The chosen target for `target: 'target'`. */
  targetId?: string;
  /** From a `spend` effect. */
  spent?: number;
  /** From an X-cost card. */
  x?: number;
}

export interface QueuedEffect {
  effect: Effect;
  ctx: EffectContext;
}

export type Phase = 'player' | 'enemy' | 'won' | 'lost';

export interface CombatState {
  seed: string;
  turn: number;
  phase: Phase;
  hero: HeroState;
  piles: { draw: CardInstance[]; hand: CardInstance[]; discard: CardInstance[]; exhaust: CardInstance[] };
  /** The card currently resolving; goes to discard/exhaust when its queue drains. */
  inPlay: CardInstance | null;
  enemies: EnemyInstance[];
  queue: QueuedEffect[];
  prompt: Prompt | null;
  events: CombatEvent[];
  nextUid: number;
  rng: Streams;
}

/** The content the engine needs. Tests hand in fixtures; the game hands in everything. */
export interface Content {
  cards: Record<string, Card>;
  enemies: Record<string, Enemy>;
  classes?: Record<string, ClassDef>;
}

export interface HeroSetup {
  classId: ClassId;
  maxHp: number;
  hp?: number;
  gold?: number;
  deck: { cardId: string; upgraded?: boolean }[];
  companion?: CompanionId;
  /** Starting resources (relic effects arrive in Phase 5). */
  resources?: Partial<Record<ResourceName, number>>;
  maxEnergy?: number;
}

export interface EncounterSetup {
  enemies: string[];
}
