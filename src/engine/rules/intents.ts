import type { Effect, Move, Pattern } from '../../content/schema';
import { evalAmount } from './effects';
import { intentScripts } from './scripts';
import { calcAttackDamage, getStatus } from './statuses';
import type { CombatState, Content, EnemyInstance, Intent } from './types';

function eligible(state: CombatState, e: EnemyInstance, id: string, move: Move | undefined): boolean {
  if (!move) return false;
  if (move.once && e.usedOnce.includes(id)) return false;
  if (move.requires && !e.flags[move.requires]) return false;
  if (move.firstTurn && e.history.length > 0) return false;
  void state;
  return true;
}

function pickFromPattern(state: CombatState, content: Content, e: EnemyInstance, pattern: Pattern): string {
  const def = content.enemies[e.enemyId]!;
  switch (pattern.type) {
    case 'cycle': {
      const n = pattern.moves.length;
      const start = e.history.length % n;
      for (let k = 0; k < n; k++) {
        const id = pattern.moves[(start + k) % n]!;
        if (eligible(state, e, id, def.moves[id])) return id;
      }
      return pattern.moves[start]!;
    }
    case 'weighted': {
      const noRepeat = pattern.noRepeat ?? 1;
      const recent = e.history.slice(-noRepeat);
      let ids = Object.keys(pattern.moves).filter((id) => eligible(state, e, id, def.moves[id]));
      const fresh = ids.filter((id) => !recent.includes(id));
      if (fresh.length) ids = fresh;
      if (!ids.length) ids = Object.keys(pattern.moves);
      return state.rng.enemyMoves.weighted(ids, ids.map((id) => pattern.moves[id]!));
    }
    case 'script': {
      const fn = intentScripts[pattern.id];
      if (!fn) throw new Error(`unknown intent script ${pattern.id}`);
      return fn(state, content, e);
    }
  }
}

/** Decide the enemy's next move, entering a new HP phase if one applies, and emit. */
export function chooseIntent(state: CombatState, content: Content, e: EnemyInstance): void {
  if (!e.alive) return;
  const def = content.enemies[e.enemyId]!;
  let moveId: string | null = null;

  const phases = def.phases ?? [];
  let active = -1;
  for (let i = 0; i < phases.length; i++) if (e.hp < e.maxHp * phases[i]!.below) active = i;
  if (active > e.phase) {
    e.phase = active;
    state.events.push({ t: 'phase', enemy: e.id, phase: active });
    const enter = phases[active]!.onEnter;
    if (enter && def.moves[enter]) moveId = enter;
  }

  const pattern = e.phase >= 0 ? phases[e.phase]!.pattern : def.pattern;
  moveId ??= pickFromPattern(state, content, e, pattern);
  e.intent = previewIntent(state, content, e, moveId);
  emitIntent(state, e);
}

/** The badge numbers, from the same maths the move will resolve with. */
export function previewIntent(state: CombatState, content: Content, e: EnemyInstance, moveId: string): Intent {
  const def = content.enemies[e.enemyId]!;
  const move = def.moves[moveId];
  if (!move) throw new Error(`enemy ${e.enemyId} has no move ${moveId}`);
  const intent: Intent = { move: moveId, kind: move.intent, hidden: !!move.hidden };
  const ctx = { source: { kind: 'enemy' as const, id: e.id }, targetId: 'hero' };
  let damage = 0;
  let hits = 0;
  let block = 0;
  const walk = (effects: Effect[]) => {
    for (const ef of effects) {
      if (ef.do === 'damage' && (ef.target === 'hero' || ef.target === 'target')) {
        const per = Math.floor(calcAttackDamage(evalAmount(state, ef.amount, ctx), e.statuses, state.hero.statuses) * (state.mods?.enemyDamage ?? 1));
        const n = ef.times ?? 1;
        // Multi-hit badges show one hit's damage and the count, like StS.
        damage = damage ? damage : per;
        hits += n;
      } else if (ef.do === 'block' && (ef.target === undefined || ef.target === 'self')) {
        block += evalAmount(state, ef.amount, ctx);
      } else if (ef.do === 'if') {
        walk(ef.then);
      }
    }
  };
  walk(move.effects);
  if (hits > 0) {
    intent.damage = damage;
    intent.hits = hits;
  }
  if (block > 0) intent.block = block;
  return intent;
}

/** Recompute every living enemy's preview (Strength or Vulnerable changed); emit only on change. */
export function refreshIntents(state: CombatState, content: Content): void {
  for (const e of state.enemies) {
    if (!e.alive || !e.intent) continue;
    const fresh = previewIntent(state, content, e, e.intent.move);
    if (fresh.damage !== e.intent.damage || fresh.hits !== e.intent.hits || fresh.block !== e.intent.block) {
      e.intent = fresh;
      emitIntent(state, e);
    }
  }
}

function emitIntent(state: CombatState, e: EnemyInstance): void {
  const i = e.intent;
  if (!i) return;
  state.events.push({ t: 'intent', enemy: e.id, kind: i.kind, hidden: i.hidden, damage: i.damage, hits: i.hits, block: i.block });
}

/** Frozen, Stunned or Waiting: the enemy loses its action. */
export function skipReason(e: EnemyInstance): 'stun' | 'frozen' | 'wait' | null {
  if (getStatus(e.statuses, 'stun') > 0) return 'stun';
  if (getStatus(e.statuses, 'frozen') > 0) return 'frozen';
  if (getStatus(e.statuses, 'wait') > 0) return 'wait';
  return null;
}
