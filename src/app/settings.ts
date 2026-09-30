/**
 * Player settings. Pure module: storage is injected so it tests in node and
 * survives a browser where localStorage throws.
 */
export type Motion = 'full' | 'fast' | 'reduced';

export type EnemyPace = 'measured' | 'fast';
/**
 * Which set of pictures to play with. `illustrated` is the hand-drawn art;
 * `placeholder` is the generated shapes the game was built against, which Paul
 * calls the alpha art and the setting labels that way.
 *
 * These ids deliberately do not reuse the old `alpha` / `development` pair: that
 * spelling meant the opposite of what it says now, so a stored one is rejected
 * and falls back to the default rather than silently flipping someone's art.
 */
export type Artwork = 'illustrated' | 'placeholder';

export interface Settings {
  motion: Motion;
  /** How long the enemies' turn takes. New players need to see what hit them. */
  enemyPace: EnemyPace;
  artwork: Artwork;
  shake: boolean;
  volume: { master: number; music: number; sfx: number };
}

export const SETTINGS_KEY = 'tome.settings.v1';

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSettings(prefersReducedMotion = false): Settings {
  return {
    motion: prefersReducedMotion ? 'reduced' : 'full',
    enemyPace: 'measured',
    artwork: 'illustrated',
    shake: !prefersReducedMotion,
    volume: { master: 0.8, music: 0.7, sfx: 0.9 },
  };
}

/** Duration multiplier for tweens under each motion setting. */
export const MOTION_SCALE: Record<Motion, number> = { full: 1, fast: 0.5, reduced: 0.05 };

/** How much longer the enemies' turn runs than the player's. */
export const ENEMY_PACE_SCALE: Record<EnemyPace, number> = { measured: 1.5, fast: 1 };

function isMotion(v: unknown): v is Motion {
  return v === 'full' || v === 'fast' || v === 'reduced';
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** Merge whatever was stored onto the defaults, ignoring anything malformed. */
export function parseSettings(raw: string | null, defaults: Settings): Settings {
  if (!raw) return defaults;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!data || typeof data !== 'object') return defaults;
  const d = data as Record<string, unknown>;
  const vol = (d.volume && typeof d.volume === 'object' ? d.volume : {}) as Record<string, unknown>;
  return {
    motion: isMotion(d.motion) ? d.motion : defaults.motion,
    enemyPace: d.enemyPace === 'fast' || d.enemyPace === 'measured' ? d.enemyPace : defaults.enemyPace,
    artwork: d.artwork === 'illustrated' || d.artwork === 'placeholder' ? d.artwork : defaults.artwork,
    shake: typeof d.shake === 'boolean' ? d.shake : defaults.shake,
    volume: {
      master: clamp01(vol.master, defaults.volume.master),
      music: clamp01(vol.music, defaults.volume.music),
      sfx: clamp01(vol.sfx, defaults.volume.sfx),
    },
  };
}

export type Listener = (s: Settings) => void;

export class SettingsStore {
  private value: Settings;
  private listeners = new Set<Listener>();

  constructor(private storage: KeyValue | null, defaults: Settings) {
    let raw: string | null;
    try {
      raw = storage?.getItem(SETTINGS_KEY) ?? null;
    } catch {
      raw = null;
    }
    this.value = parseSettings(raw, defaults);
  }

  get(): Settings {
    return this.value;
  }

  set(patch: Partial<Settings>): void {
    this.value = { ...this.value, ...patch, volume: { ...this.value.volume, ...(patch.volume ?? {}) } };
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.value));
    } catch {
      // A private window or blocked storage: the setting still applies this session.
    }
    for (const l of this.listeners) l(this.value);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
