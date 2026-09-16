import type { CombatState, EnemyInstance, HeroState } from './types';

/** Hero and enemies share the shape the maths cares about. */
export type Combatant = HeroState | EnemyInstance;

export const HERO_ID = 'hero';
export const COMPANION_ID = 'companion';

export function isEnemy(c: Combatant): c is EnemyInstance {
  return 'enemyId' in c;
}

export function combatant(state: CombatState, id: string): Combatant | null {
  if (id === HERO_ID) return state.hero;
  return state.enemies.find((e) => e.id === id) ?? null;
}

export function enemy(state: CombatState, id: string): EnemyInstance | null {
  return state.enemies.find((e) => e.id === id) ?? null;
}

export function aliveEnemies(state: CombatState): EnemyInstance[] {
  return state.enemies.filter((e) => e.alive);
}

export function idOf(c: Combatant): string {
  return isEnemy(c) ? c.id : HERO_ID;
}
