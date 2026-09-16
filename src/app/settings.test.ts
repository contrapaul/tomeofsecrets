import { describe, expect, it } from 'vitest';
import { defaultSettings, parseSettings, SETTINGS_KEY, SettingsStore, type KeyValue } from './settings';

function memory(initial: Record<string, string> = {}): KeyValue & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('parseSettings', () => {
  const d = defaultSettings();

  it('returns defaults for nothing, garbage, or the wrong shape', () => {
    expect(parseSettings(null, d)).toEqual(d);
    expect(parseSettings('{not json', d)).toEqual(d);
    expect(parseSettings('42', d)).toEqual(d);
    expect(parseSettings('"reduced"', d)).toEqual(d);
  });

  it('keeps valid fields and drops invalid ones individually', () => {
    const s = parseSettings(JSON.stringify({ motion: 'fast', shake: 'yes', volume: { master: 2, sfx: 0.2 } }), d);
    expect(s.motion).toBe('fast');
    expect(s.shake).toBe(d.shake);
    expect(s.volume).toEqual({ master: 1, music: d.volume.music, sfx: 0.2 });
  });

  it('honours the reduced-motion default', () => {
    const r = defaultSettings(true);
    expect(r.motion).toBe('reduced');
    expect(r.shake).toBe(false);
  });
});

describe('SettingsStore', () => {
  it('persists on set and notifies listeners', () => {
    const storage = memory();
    const store = new SettingsStore(storage, defaultSettings());
    const seen: string[] = [];
    store.on((s) => seen.push(s.motion));
    store.set({ motion: 'reduced' });
    expect(JSON.parse(storage.data[SETTINGS_KEY]!).motion).toBe('reduced');
    expect(seen).toEqual(['reduced']);
  });

  it('merges volume partially', () => {
    const store = new SettingsStore(memory(), defaultSettings());
    store.set({ volume: { ...store.get().volume, music: 0 } });
    expect(store.get().volume.music).toBe(0);
    expect(store.get().volume.master).toBe(0.8);
  });

  it('survives storage that throws', () => {
    const broken: KeyValue = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = new SettingsStore(broken, defaultSettings());
    expect(() => store.set({ shake: false })).not.toThrow();
    expect(store.get().shake).toBe(false);
  });
});
