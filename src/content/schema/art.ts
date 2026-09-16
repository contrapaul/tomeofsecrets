import { z } from 'zod';

/** `public/art/enemies/<id>/meta.json`, written by hand or exported from #/dev/enemy. */
export const EnemyArtMeta = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  size: z.enum(['small', 'medium', 'large']),
  /** Credits id. */
  artist: z.string().min(1),
  /** Baseline offset from the bottom of the image, if not the default 40 px. */
  baseline: z.int().min(0).optional(),
  notes: z.string().optional(),
});
export type EnemyArtMeta = z.infer<typeof EnemyArtMeta>;

export const Credit = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Shown in-game exactly as written; students choose it. */
  name: z.string().min(1),
  role: z.enum(['art', 'music', 'writing', 'design', 'code', 'test']),
  link: z.string().url().optional(),
});
export type Credit = z.infer<typeof Credit>;
export const CreditSet = z.array(Credit);

/** `src/content/generated/art.json`, written by `npm run art`. Never hand-edit. */
export const ArtManifest = z.strictObject({
  generated: z.string(),
  enemies: z.record(
    z.string(),
    z.strictObject({
      idle: z.string(),
      attack: z.string().optional(),
      hurt: z.string().optional(),
      dead: z.string().optional(),
      /** Pixi spritesheet JSON, converted from an Aseprite export. */
      sheet: z.string().optional(),
      size: z.enum(['small', 'medium', 'large']),
      artist: z.string(),
      baseline: z.int().optional(),
      width: z.int(),
      height: z.int(),
      /** First visible row of idle.png; the intent badge sits above it. */
      top: z.int().min(0),
    }),
  ),
  cards: z.record(z.string(), z.strictObject({ url: z.string(), artist: z.string().optional() })),
  portraits: z.record(z.string(), z.string()),
  backgrounds: z.record(z.string(), z.strictObject({ far: z.string(), near: z.string().optional() })),
});
export type ArtManifest = z.infer<typeof ArtManifest>;
