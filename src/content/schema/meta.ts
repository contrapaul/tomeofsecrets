import { z } from 'zod';
import { ClassId } from './card';
import { ResourceName } from './effect';

/** Run-start choices and the unlock tree (docs/design.md §9). */

export const CompanionId = z.enum(['wolf', 'bear', 'hawk', 'serpent', 'boar']);
export type CompanionId = z.infer<typeof CompanionId>;

export const BoonEffect = z.discriminatedUnion('do', [
  z.strictObject({ do: z.literal('maxHp'), amount: z.int() }),
  z.strictObject({ do: z.literal('gold'), amount: z.int() }),
  z.strictObject({ do: z.literal('rareCard') }),
  z.strictObject({ do: z.literal('relic'), tier: z.enum(['common', 'boss']) }),
  z.strictObject({ do: z.literal('removeStarters') }),
  z.strictObject({ do: z.literal('transform'), count: z.int().min(1) }),
  z.strictObject({ do: z.literal('upgradeStarters'), count: z.int().min(1) }),
  z.strictObject({ do: z.literal('vials'), count: z.int().min(1) }),
  /** A flag on the run, read by the run layer (e.g. `enemyLore`). */
  z.strictObject({ do: z.literal('runFlag'), flag: z.string() }),
  /** A flag handed to every fight. */
  z.strictObject({ do: z.literal('fightFlag'), flag: z.string() }),
  z.strictObject({ do: z.literal('resource'), name: ResourceName, amount: z.int().min(1) }),
]);
export type BoonEffect = z.infer<typeof BoonEffect>;

export const Boon = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  class: ClassId.optional(),
  text: z.string(),
  effects: z.array(BoonEffect).min(1),
});
export type Boon = z.infer<typeof Boon>;
export const BoonSet = z.array(Boon);

export const Origin = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  class: ClassId,
  name: z.string(),
  blurb: z.string(),
  /** The class's first Origin; needs no Page. */
  default: z.boolean().optional(),
  /** Starter cards swapped out for others: [out, in]. */
  swaps: z.array(z.tuple([z.string(), z.string()])),
  relic: z.string(),
  companion: CompanionId.optional(),
});
export type Origin = z.infer<typeof Origin>;
export const OriginSet = z.array(Origin);

export const PageKind = z.enum(['cards', 'relics', 'boon', 'origin', 'companion']);
export type PageKind = z.infer<typeof PageKind>;

/** One purchasable page of the Tome. Anything no page claims is unlocked from the start. */
export const Page = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: PageKind,
  name: z.string(),
  cost: z.int().min(0),
  class: ClassId.optional(),
  blurb: z.string().optional(),
  unlocks: z.array(z.string()).min(1),
  requires: z.string().optional(),
});
export type Page = z.infer<typeof Page>;
export const PageSet = z.array(Page);

// ---------------------------------------------------------------- the profile

export const BestiaryEntry = z.object({
  /** Fights this enemy has appeared in. */
  seen: z.int().min(0),
  kills: z.int().min(0),
  /** Move ids it has used in front of this player. */
  moves: z.array(z.string()),
});
export type BestiaryEntry = z.infer<typeof BestiaryEntry>;

export const RunRecord = z.object({
  seed: z.string(),
  classId: ClassId,
  result: z.enum(['won', 'lost', 'abandoned']),
  floor: z.int(),
  chapter: z.int(),
  seal: z.int(),
  lore: z.int(),
  date: z.string(),
  killedBy: z.string().optional(),
  origin: z.string().optional(),
  boon: z.string().optional(),
});
export type RunRecord = z.infer<typeof RunRecord>;

/** Everything that survives a run. `tome.profile.v1`, and the save code. */
export const Profile = z.object({
  version: z.literal(1),
  lore: z.int().min(0),
  loreEarned: z.int().min(0),
  bestiary: z.record(z.string(), BestiaryEntry),
  cardsSeen: z.array(z.string()),
  relicsSeen: z.array(z.string()),
  pages: z.array(z.string()),
  /** Highest Seal unlocked per class. */
  seals: z.record(z.string(), z.int().min(0).max(10)),
  stats: z.object({
    runs: z.int().min(0),
    wins: z.record(z.string(), z.int().min(0)),
    bestFloor: z.record(z.string(), z.int().min(0)),
    kills: z.int().min(0),
    cardsPlayed: z.record(z.string(), z.int().min(0)),
    fastestWinMs: z.int().min(0).nullable(),
  }),
  history: z.array(RunRecord),
});
export type Profile = z.infer<typeof Profile>;
