import type { StatusId, ResourceName, IntentKind } from '../content/schema';

/**
 * Presentation cues. The engine appends one at every mutation; the combat
 * scene drains them on a timeline. A test asserts each mutation site emits.
 */
/** How the hit landed, for the screen flash colour: a swing, poison ticking, or something else (Thorns, a bomb). */
export type DamageKind = 'attack' | 'poison' | 'effect';

export type CombatEvent =
  | { t: 'fightStart' }
  | { t: 'turnStart'; turn: number; side: 'hero' | 'enemy' }
  | { t: 'draw'; uids: number[] }
  | { t: 'shuffle'; count: number }
  | { t: 'play'; uid: number; cardId: string; targetId?: string }
  | { t: 'cardMoved'; uid: number; to: 'hand' | 'discard' | 'exhaust' | 'draw' | 'powers' | 'gone' }
  | { t: 'damage'; target: string; amount: number; blocked: number; hp: number; source?: string; killed: boolean; kind: DamageKind }
  | { t: 'negated'; target: string; by: 'images' | 'trap' | 'intangible' }
  | { t: 'block'; target: string; amount: number; total: number }
  | { t: 'status'; target: string; status: StatusId; delta: number; total: number }
  | { t: 'heal'; target: string; amount: number; hp: number }
  | { t: 'energy'; delta: number; total: number }
  | { t: 'gold'; delta: number; total: number }
  | { t: 'resource'; name: ResourceName; delta: number; total: number }
  | { t: 'die'; target: string }
  | { t: 'intent'; enemy: string; kind: IntentKind; hidden: boolean; damage?: number; hits?: number; block?: number }
  | { t: 'enemyAct'; enemy: string; move: string; skipped?: 'stun' | 'frozen' | 'wait' | 'countered' }
  | { t: 'summon'; enemy: string; enemyId: string }
  | { t: 'trap'; uid: number; cardId: string; state: 'armed' | 'fired' | 'replaced' }
  | { t: 'companion'; action: 'act' | 'enrage' | 'stun' | 'unstun' | 'feed' }
  | { t: 'power'; uid: number; cardId: string; state: 'added' | 'fired' | 'removed' }
  | { t: 'phase'; enemy: string; phase: number }
  | { t: 'prompt'; kind: 'discard' | 'exhaust' | 'retrieve'; count: number }
  | { t: 'vial'; id: string; index: number; targetId?: string }
  | { t: 'end'; result: 'won' | 'lost' };

export type EventType = CombatEvent['t'];
