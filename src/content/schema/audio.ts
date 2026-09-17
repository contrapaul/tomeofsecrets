import { z } from 'zod';

/** Every sound the game asks for, by name. A missing file is silence, never an error. */
export const SFX_IDS = [
  'card-draw', 'card-hover', 'card-play', 'card-discard', 'card-exhaust', 'card-pick',
  'hit-light', 'hit-heavy', 'hit-blocked', 'block', 'heal', 'buff', 'debuff',
  'enemy-attack', 'enemy-die', 'hero-hurt',
  'turn-start', 'turn-end', 'ui-click', 'map-move', 'gold', 'shop-buy', 'rest',
  'victory', 'defeat', 'secret',
] as const;
export type SfxId = (typeof SFX_IDS)[number];

/** Music keys: scenes ask for one of these; `fight-2`, `fight-3` for later chapters. */
export const MUSIC_KEY = /^(title|map|fight(-[2-9])?|elite|boss|tome)$/;

/** `public/audio/music/<key>.json`, optional, beside the music file. */
export const MusicMeta = z.strictObject({
  /** Credits id of the composer. */
  artist: z.string().min(1).optional(),
  title: z.string().optional(),
  /** Loop points in seconds; the whole file loops when absent. */
  loopStart: z.number().min(0).optional(),
  loopEnd: z.number().min(0).optional(),
});
export type MusicMeta = z.infer<typeof MusicMeta>;

/** `src/content/generated/audio.json`, written by `npm run audio`. Never hand-edit. */
export const AudioManifest = z.strictObject({
  generated: z.string(),
  /** Sound id → one or more files; the game picks one at random per play. */
  sfx: z.record(z.string(), z.array(z.string()).min(1)),
  music: z.record(z.string(), z.strictObject({ url: z.string() }).extend(MusicMeta.shape)),
});
export type AudioManifest = z.infer<typeof AudioManifest>;
