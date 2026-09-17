import { z } from 'zod';
import { Effect, ResourceName } from './effect';
import { ClassId } from './card';

export const EncounterPools = z.strictObject({
  chapter: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** The first three fights of the chapter draw from here. */
  easy: z.array(z.array(z.string()).min(1)).min(1),
  normal: z.array(z.array(z.string()).min(1)).min(1),
  elite: z.array(z.array(z.string()).min(1)).min(1),
  boss: z.array(z.array(z.string()).min(1)).min(1),
});
export type EncounterPools = z.infer<typeof EncounterPools>;

export const RelicTier = z.enum(['starter', 'common', 'uncommon', 'rare', 'boss']);
export type RelicTier = z.infer<typeof RelicTier>;

export const Relic = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  tier: RelicTier,
  /** Offered only to this class. */
  class: ClassId.optional(),
  text: z.string(),
  /** In-fight behaviour: flags the engine honours, and effects at fight or turn start. */
  combat: z
    .strictObject({
      flags: z.array(z.string()).optional(),
      fightStart: z.array(Effect).optional(),
      turnStart: z.array(Effect).optional(),
      /** A resource to start each fight with. */
      resource: z.strictObject({ name: ResourceName, amount: z.int() }).optional(),
    })
    .optional(),
  /** Out-of-fight behaviour, read by the run layer. */
  run: z
    .strictObject({
      maxHp: z.int().optional(),
      energy: z.int().optional(),
      goldMult: z.number().optional(),
      goldAfterFight: z.int().optional(),
      healAfterFight: z.int().optional(),
      shopMult: z.number().optional(),
      restBonus: z.number().optional(),
      vialSlots: z.int().optional(),
      smithUpgrades: z.int().optional(),
      treasureChoices: z.int().optional(),
      upgradeRandomAttacks: z.int().optional(),
      /** The revive flag is granted once per run. */
      oncePerRun: z.boolean().optional(),
    })
    .optional(),
  /** Credits id for the icon, when drawn. */
  artist: z.string().optional(),
});
export type Relic = z.infer<typeof Relic>;
export const RelicSet = z.array(Relic);

export const Vial = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare']),
  target: z.enum(['enemy', 'none']),
  text: z.string(),
  effects: z.array(Effect),
  /** Phoenix Feather: not used by the player; it fires when you would die. */
  passive: z.enum(['revive']).optional(),
});
export type Vial = z.infer<typeof Vial>;
export const VialSet = z.array(Vial);
