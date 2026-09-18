import type { Spritesheet} from 'pixi.js';
import { Assets, Rectangle, Texture } from 'pixi.js';
import manifestJson from '../content/generated/art.json';
import { ArtManifest } from '../content/schema/art';

/**
 * What art exists (from the generated manifest) and how to load it. Nothing
 * else in the UI guesses at URLs. Missing art is normal: callers get null
 * and draw a placeholder.
 */
export const ART: ArtManifest = ArtManifest.parse(manifestJson);

export interface EnemyTextures {
  idle: Texture;
  attack?: Texture;
  hurt?: Texture;
  dead?: Texture;
  sheet?: Spritesheet;
  /** Pixels from the bottom of the image to the feet. */
  baseline: number;
  /** Visible height above the feet: image height minus baseline minus the empty rows on top. */
  visibleHeight: number;
  size: 'small' | 'medium' | 'large';
  artist: string;
  /** Hovers this far above the ground (bobbing idle, smaller shadow). */
  float: number;
}

const enemyCache = new Map<string, EnemyTextures>();
const cardCache = new Map<string, Texture>();

/** Load one asset; a bad or missing file logs and yields undefined rather than breaking the scene. */
async function safe<T>(url: string | undefined): Promise<T | undefined> {
  if (!url) return undefined;
  try {
    return await Assets.load<T>(`/${url}`);
  } catch (err) {
    console.warn(`art: could not load ${url}`, err);
    return undefined;
  }
}

export function hasEnemyArt(id: string): boolean {
  return id in ART.enemies;
}

/** Load an enemy's textures (idle plus any poses or sheet). Null when there is no art. */
export async function loadEnemyArt(id: string): Promise<EnemyTextures | null> {
  const entry = ART.enemies[id];
  if (!entry) return null;
  const cached = enemyCache.get(id);
  if (cached) return cached;
  const [idle, attack, hurt, dead, sheet] = await Promise.all([
    safe<Texture>(entry.idle),
    safe<Texture>(entry.attack),
    safe<Texture>(entry.hurt),
    safe<Texture>(entry.dead),
    safe<Spritesheet>(entry.sheet),
  ]);
  if (!idle) return null;
  const baseline = entry.baseline ?? 40;
  const out: EnemyTextures = { idle, attack, hurt, dead, sheet, baseline, visibleHeight: entry.height - baseline - entry.top, size: entry.size, artist: entry.artist, float: entry.float ?? 0 };
  enemyCache.set(id, out);
  return out;
}

export async function loadEnemyArtFor(ids: string[]): Promise<Map<string, EnemyTextures>> {
  const out = new Map<string, EnemyTextures>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const t = await loadEnemyArt(id);
      if (t) out.set(id, t);
    }),
  );
  return out;
}

/** Card art cropped to the card's art slot ratio (216:122). */
export async function loadCardArt(id: string): Promise<Texture | null> {
  const entry = ART.cards[id];
  if (!entry) return null;
  const cached = cardCache.get(id);
  if (cached) return cached;
  const full = await safe<Texture>(entry.url);
  if (!full) return null;
  const ratio = 216 / 122;
  const w = full.width;
  const h = Math.min(full.height, Math.round(w / ratio));
  const cropped = new Texture({ source: full.source, frame: new Rectangle(0, Math.round((full.height - h) / 2), w, h) });
  cardCache.set(id, cropped);
  return cropped;
}

export async function loadCardArtFor(ids: string[]): Promise<Map<string, Texture>> {
  const out = new Map<string, Texture>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const t = await loadCardArt(id);
      if (t) out.set(id, t);
    }),
  );
  return out;
}

export async function loadBackground(key: string): Promise<{ far: Texture; mid?: Texture; near?: Texture } | null> {
  const entry = ART.backgrounds[key];
  if (!entry) return null;
  const [far, mid, near] = await Promise.all([safe<Texture>(entry.far), safe<Texture>(entry.mid), safe<Texture>(entry.near)]);
  if (!far) return null;
  return { far, mid, near };
}

/** Build enemy textures from an image the user dropped on a dev page. */
export function texturesFromBitmap(bitmap: ImageBitmap, size: EnemyTextures['size']): EnemyTextures {
  return { idle: Texture.from(bitmap), baseline: 40, visibleHeight: Math.round(bitmap.height * 0.8), size, artist: 'you', float: 0 };
}
