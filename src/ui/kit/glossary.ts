import type { StatusId } from '../../content/schema';

/** Tooltip copy. Numbers here are the rules' constants; keep them in step with docs/design.md §3. */
export const STATUS_INFO: Record<StatusId, { name: string; text: string }> = {
  strength: { name: 'Strength', text: 'Attacks deal this much more damage per hit.' },
  dexterity: { name: 'Dexterity', text: 'Gain this much more block whenever you gain block.' },
  vulnerable: { name: 'Vulnerable', text: 'Takes 50% more damage from attacks. Wears off by 1 each turn.' },
  weak: { name: 'Weak', text: 'Attacks deal 25% less damage. Wears off by 1 each turn.' },
  frail: { name: 'Frail', text: 'Gains 25% less block. Wears off by 1 each turn.' },
  poison: { name: 'Poison', text: 'At the start of its turn, loses this much HP, ignoring block. Then it drops by 1.' },
  burn: { name: 'Burn', text: 'At the start of its turn, takes this much damage. Then it drops by 1.' },
  chill: { name: 'Chill', text: 'Each hit deals this much less. At 5 Chill a normal enemy is Frozen; an elite or boss Shatters for 15 instead. Wears off by 1 each turn.' },
  frozen: { name: 'Frozen', text: 'Skips its next action, then thaws.' },
  mark: { name: 'Mark', text: 'Attacks against this enemy deal 3 more. Each hit uses up one Mark.' },
  thorns: { name: 'Thorns', text: 'Whoever attacks this takes this much damage per hit.' },
  regen: { name: 'Regen', text: 'Heals this much at the end of its turn. Then it drops by 1.' },
  artifact: { name: 'Artifact', text: 'The next debuff applied is negated instead. Each use spends one.' },
  platedArmor: { name: 'Plated Armor', text: 'Gains this much block at the end of its turn. Loses 1 whenever it takes HP damage.' },
  metallicize: { name: 'Metallicize', text: 'Gains this much block at the end of its turn.' },
  intangible: { name: 'Intangible', text: 'Takes at most 1 damage from any source. Wears off by 1 each turn.' },
  images: { name: 'Images', text: 'The next attacks against you are negated, one image per attack.' },
  stun: { name: 'Stunned', text: 'Skips its next action.' },
  wait: { name: 'Waiting', text: 'Its next action is postponed one turn.' },
  ritual: { name: 'Ritual', text: 'Gains this much Strength at the end of its turn.' },
  enrage: { name: 'Enrage', text: 'Gains this much Strength whenever you play a Skill.' },
  bomb: { name: 'Bomb', text: 'When this enemy dies, every other enemy takes this much damage.' },
};

export const KEYWORD_INFO: Record<string, string> = {
  Exhaust: 'Removed from the fight when played.',
  Retain: 'Not discarded at the end of your turn.',
  Innate: 'Starts in your opening hand.',
  Ethereal: 'Exhausts if still in your hand at the end of your turn.',
  Unplayable: 'Cannot be played.',
  Armed: 'A trap. It waits, then fires once on its trigger. You can hold two.',
};
