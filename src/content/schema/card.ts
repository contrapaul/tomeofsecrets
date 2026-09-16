import { z } from 'zod';
import { CardTag, Effect } from './effect';

export const CLASS_IDS = ['paladin', 'tracker', 'mage'] as const;
export const ClassId = z.enum(CLASS_IDS);
export type ClassId = z.infer<typeof ClassId>;

export const CardClass = z.enum([...CLASS_IDS, 'neutral', 'secret', 'curse', 'status']);
export type CardClass = z.infer<typeof CardClass>;

export const CardType = z.enum(['attack', 'skill', 'power', 'status', 'curse']);
export type CardType = z.infer<typeof CardType>;

export const Rarity = z.enum(['starter', 'common', 'uncommon', 'rare', 'secret', 'curse', 'status']);
export type Rarity = z.infer<typeof Rarity>;

export const Keyword = z.enum(['exhaust', 'retain', 'innate', 'ethereal', 'unplayable']);
export type Keyword = z.infer<typeof Keyword>;

/** What a card needs the player to aim at. `enemy` is refused without a target. */
export const CardTarget = z.enum(['enemy', 'none']);
export type CardTarget = z.infer<typeof CardTarget>;

const CardBase = z.strictObject({
  name: z.string().min(1),
  /** 'X' spends all energy; the resolver sees it as `spent`. */
  cost: z.union([z.int().min(0), z.literal('X')]),
  effects: z.array(Effect),
  keywords: z.array(Keyword).optional(),
  /** Overrides the generated text. Required for any card with a `script` effect. */
  text: z.string().optional(),
});

export const Card = CardBase.extend({
  id: z.string().regex(/^[a-z0-9-]+$/),
  class: CardClass,
  type: CardType,
  rarity: Rarity,
  target: CardTarget,
  tags: z.array(CardTag).optional(),
  /** Partial override applied on upgrade. Every card must have one. */
  upgrade: CardBase.partial(),
  /** Enemy id, for Secrets. */
  from: z.string().optional(),
  art: z.string().optional(),
  artist: z.string().optional(),
  /** Only playable under this condition: e.g. Kill Shot, Ambush. */
  playableIf: z.union([z.literal('targetBelowHalf'), z.literal('firstCardThisTurn')]).optional(),
  /** Curses and statuses mostly: fires when the card is drawn (Smudge, Redlined). */
  onDraw: z.array(Effect).optional(),
  /** Fires if the card is still in hand at end of turn (Doubt, Clumsy, Pride). */
  onEndOfTurnInHand: z.array(Effect).optional(),
  /** Fires at the start of every fight while the card is in the deck (Debt). */
  onFightStart: z.array(Effect).optional(),
});
export type Card = z.infer<typeof Card>;

export const CardSet = z.array(Card);
