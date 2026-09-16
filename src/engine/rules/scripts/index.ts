import type { CombatState, Content, EffectContext, EnemyInstance } from '../types';

/**
 * The escape hatch. A `{ do: 'script', id }` effect looks up its id here.
 * Keep this list short; if it grows past a handful, extend the effect
 * language instead (docs/plans.md, Engine conventions).
 */
export type ScriptFn = (state: CombatState, content: Content, ctx: EffectContext) => void;

/** Enemy intent scripts: given the enemy, return the move id to use next. */
export type IntentScriptFn = (state: CombatState, content: Content, enemy: EnemyInstance) => string;

export const scripts: Record<string, ScriptFn> = {};
export const intentScripts: Record<string, IntentScriptFn> = {};

export function registerScript(id: string, fn: ScriptFn): void {
  scripts[id] = fn;
}

export function registerIntentScript(id: string, fn: IntentScriptFn): void {
  intentScripts[id] = fn;
}
