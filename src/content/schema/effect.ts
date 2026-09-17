import { z } from 'zod';

/**
 * The effect language. Cards, enemy moves, relics, vials, boons and events all
 * express behaviour as a list of these, resolved by one `resolveEffect`.
 * docs/design.md §12 is the human description; this file is the truth.
 */

export const STATUS_IDS = [
  'strength', 'dexterity', 'vulnerable', 'weak', 'frail', 'poison', 'burn', 'chill', 'frozen',
  'mark', 'thorns', 'regen', 'artifact', 'platedArmor', 'metallicize', 'intangible', 'images',
  'stun', 'wait', 'ritual', 'enrage', 'bomb',
] as const;
export const StatusId = z.enum(STATUS_IDS);
export type StatusId = z.infer<typeof StatusId>;

/** Buffs and debuffs, for Artifact and for "remove your debuffs". */
export const DEBUFFS: readonly StatusId[] = ['vulnerable', 'weak', 'frail', 'poison', 'burn', 'chill', 'frozen', 'mark', 'stun', 'wait', 'bomb'];
export const BUFFS: readonly StatusId[] = ['strength', 'dexterity', 'thorns', 'regen', 'artifact', 'platedArmor', 'metallicize', 'intangible', 'images', 'ritual', 'enrage'];

export const ENEMY_TAGS = ['beast', 'undead', 'spirit', 'demon', 'construct', 'ooze', 'plant', 'humanoid'] as const;
export const EnemyTag = z.enum(ENEMY_TAGS);
export type EnemyTag = z.infer<typeof EnemyTag>;

export const CARD_TAGS = ['arcane', 'fire', 'frost'] as const;
export const CardTag = z.enum(CARD_TAGS);
export type CardTag = z.infer<typeof CardTag>;

export const Target = z.enum(['target', 'all', 'random', 'self', 'hero', 'companion']);
export type Target = z.infer<typeof Target>;

export const ResourceName = z.enum(['holyPower', 'charge']);
export type ResourceName = z.infer<typeof ResourceName>;

export const ScaleBy = z.enum([
  'holyPower', 'charge', 'block', 'targetBurn', 'targetChill', 'targetMark', 'cardsInHand', 'energy', 'spent', 'strength',
]);
export type ScaleBy = z.infer<typeof ScaleBy>;

export const Amount = z.union([
  z.int(),
  z.strictObject({ base: z.int(), per: ScaleBy, mult: z.number() }),
]);
export type Amount = z.infer<typeof Amount>;

export const Condition = z.union([
  z.strictObject({ resourceAtLeast: ResourceName, amount: z.int() }),
  z.strictObject({ targetHas: StatusId }),
  z.strictObject({ targetBelowHp: z.number().gt(0).lte(1) }),
  z.strictObject({ heroBelowHp: z.number().gt(0).lte(1) }),
  z.strictObject({ playedNoAttack: z.literal(true) }),
  z.strictObject({ firstCardThisTurn: z.literal(true) }),
  z.strictObject({ targetTag: EnemyTag }),
  z.strictObject({ flag: z.string() }),
  z.strictObject({ goldAtLeast: z.int() }),
]);
export type Condition = z.infer<typeof Condition>;

export const PowerTrigger = z.enum([
  'startTurn', 'endTurn', 'onAttackPlayed', 'onSkillPlayed', 'onCardPlayed', 'onExhaust',
  'onEnemyDeath', 'onResourceGain', 'onEnemyAttack', 'onDamageTaken', 'onFireAttack',
]);
export type PowerTrigger = z.infer<typeof PowerTrigger>;

export const TrapTrigger = z.enum(['enemyAttack', 'enemyBuff', 'enemyTurnStart']);
export type TrapTrigger = z.infer<typeof TrapTrigger>;

export type Effect =
  | { do: 'damage'; amount: Amount; target: Target; times?: number; tags?: CardTag[] }
  | { do: 'block'; amount: Amount; target?: Target }
  | { do: 'status'; status: StatusId; amount: Amount; target: Target }
  | { do: 'removeStatus'; status: StatusId | 'debuffs' | 'buffs'; target: Target }
  | { do: 'draw'; amount: Amount }
  | { do: 'energy'; amount: Amount }
  | { do: 'heal'; amount: Amount; target?: Target }
  | { do: 'gold'; amount: Amount }
  | { do: 'resource'; name: ResourceName; amount: Amount }
  | { do: 'spend'; name: ResourceName; then: Effect[] }
  | { do: 'exhaust'; from: 'hand' | 'random' | 'choose'; count?: number }
  | { do: 'discard'; from: 'hand' | 'random' | 'choose'; count?: number }
  | { do: 'retrieve'; from: 'discard' | 'exhaust'; count?: number }
  | { do: 'addCard'; card: string; to: 'hand' | 'discard' | 'draw'; upgraded?: boolean; count?: number }
  | { do: 'trap'; trigger: TrapTrigger; effects: Effect[] }
  | { do: 'companion'; action: 'act' | 'enrage' | 'unstun' | 'feed'; bonus?: number }
  | { do: 'power'; trigger: PowerTrigger; effects: Effect[]; name?: string }
  | { do: 'if'; when: Condition; then: Effect[]; else?: Effect[] }
  | { do: 'summon'; enemy: string; count?: number; max?: number }
  | { do: 'flag'; name: string }
  | { do: 'script'; id: string };

export const Effect: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion('do', [
    z.strictObject({ do: z.literal('damage'), amount: Amount, target: Target, times: z.int().min(1).optional(), tags: z.array(CardTag).optional() }),
    z.strictObject({ do: z.literal('block'), amount: Amount, target: Target.optional() }),
    z.strictObject({ do: z.literal('status'), status: StatusId, amount: Amount, target: Target }),
    z.strictObject({ do: z.literal('removeStatus'), status: z.union([StatusId, z.literal('debuffs'), z.literal('buffs')]), target: Target }),
    z.strictObject({ do: z.literal('draw'), amount: Amount }),
    z.strictObject({ do: z.literal('energy'), amount: Amount }),
    z.strictObject({ do: z.literal('heal'), amount: Amount, target: Target.optional() }),
    z.strictObject({ do: z.literal('gold'), amount: Amount }),
    z.strictObject({ do: z.literal('resource'), name: ResourceName, amount: Amount }),
    z.strictObject({ do: z.literal('spend'), name: ResourceName, then: z.array(Effect) }),
    z.strictObject({ do: z.literal('exhaust'), from: z.enum(['hand', 'random', 'choose']), count: z.int().min(1).optional() }),
    z.strictObject({ do: z.literal('discard'), from: z.enum(['hand', 'random', 'choose']), count: z.int().min(1).optional() }),
    z.strictObject({ do: z.literal('retrieve'), from: z.enum(['discard', 'exhaust']), count: z.int().min(1).optional() }),
    z.strictObject({ do: z.literal('addCard'), card: z.string(), to: z.enum(['hand', 'discard', 'draw']), upgraded: z.boolean().optional(), count: z.int().min(1).optional() }),
    z.strictObject({ do: z.literal('trap'), trigger: TrapTrigger, effects: z.array(Effect) }),
    z.strictObject({ do: z.literal('companion'), action: z.enum(['act', 'enrage', 'unstun', 'feed']), bonus: z.int().optional() }),
    z.strictObject({ do: z.literal('power'), trigger: PowerTrigger, effects: z.array(Effect), name: z.string().optional() }),
    z.strictObject({ do: z.literal('if'), when: Condition, then: z.array(Effect), else: z.array(Effect).optional() }),
    z.strictObject({ do: z.literal('summon'), enemy: z.string(), count: z.int().min(1).optional(), max: z.int().min(1).optional() }),
    z.strictObject({ do: z.literal('flag'), name: z.string() }),
    z.strictObject({ do: z.literal('script'), id: z.string() }),
  ]),
);
