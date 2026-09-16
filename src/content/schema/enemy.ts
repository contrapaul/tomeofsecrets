import { z } from 'zod';
import { Effect, EnemyTag } from './effect';

export const IntentKind = z.enum(['attack', 'defend', 'buff', 'debuff', 'special', 'summon']);
export type IntentKind = z.infer<typeof IntentKind>;

export const Move = z.strictObject({
  intent: IntentKind,
  effects: z.array(Effect),
  /** Usable once per fight. */
  once: z.boolean().optional(),
  /** Shown as "?" until it resolves. */
  hidden: z.boolean().optional(),
  /** Only after a `flag` effect set this name. */
  requires: z.string().optional(),
  /** Only on the enemy's first action. */
  firstTurn: z.boolean().optional(),
  /** A name for the log and the Bestiary; defaults to the move key, title-cased. */
  name: z.string().optional(),
});
export type Move = z.infer<typeof Move>;

export type Pattern =
  | { type: 'cycle'; moves: string[] }
  | { type: 'weighted'; moves: Record<string, number>; noRepeat?: number }
  | { type: 'script'; id: string };

export const Pattern: z.ZodType<Pattern> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('cycle'), moves: z.array(z.string()).min(1) }),
  z.strictObject({ type: z.literal('weighted'), moves: z.record(z.string(), z.number().positive()), noRepeat: z.int().min(0).optional() }),
  z.strictObject({ type: z.literal('script'), id: z.string() }),
]);

export const Phase = z.strictObject({
  /** Fraction of max HP; the phase applies once HP is strictly below it. */
  below: z.number().gt(0).lt(1),
  pattern: Pattern,
  /** Played once on entering the phase, before the pattern. */
  onEnter: z.string().optional(),
});
export type Phase = z.infer<typeof Phase>;

export const Enemy = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  size: z.enum(['small', 'medium', 'large']),
  tags: z.array(EnemyTag),
  hp: z.tuple([z.int().min(1), z.int().min(1)]),
  rank: z.enum(['normal', 'elite', 'boss', 'minion']).optional(),
  /** Credits id. Required by lint for anything that ships. */
  artist: z.string().optional(),
  /** Card id of this enemy's Secret. Required by lint for anything that ships. */
  secret: z.string().optional(),
  /** Statuses present at the start of the fight, e.g. Artifact 2, Ritual 1. */
  start: z.record(z.string(), z.int()).optional(),
  moves: z.record(z.string(), Move),
  pattern: Pattern,
  phases: z.array(Phase).optional(),
});
export type Enemy = z.infer<typeof Enemy>;

export const EnemySet = z.array(Enemy);
