import manifestJson from '../content/generated/audio.json';
import { AudioManifest, type SfxId } from '../content/schema/audio';
import type { Settings, SettingsStore } from './settings';

/**
 * Sound. Web Audio, unlocked by the first pointer or key press (browsers
 * require it), with master/music/sfx gains from settings. Every sound is
 * optional: an id with no file is silence, and nothing waits on audio.
 */
export const AUDIO: AudioManifest = AudioManifest.parse(manifestJson);

const CROSSFADE = 0.9;

export interface PlayOptions {
  /** 0..1, on top of the sfx setting. */
  volume?: number;
  /** Playback rate; small random spread keeps repeats from sounding stamped. */
  rate?: number;
  /** Random pitch spread, e.g. 0.06 for ±6%. */
  spread?: number;
}

class AudioService {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: { key: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: string | null = null;
  private volumes: Settings['volume'];
  private hidden = false;

  constructor(settings: SettingsStore) {
    this.volumes = settings.get().volume;
    settings.on((s) => {
      this.volumes = s.volume;
      this.applyVolumes();
    });
    const unlock = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.start();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.applyVolumes();
    });
  }

  private start(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    void this.ctx.resume();
    // Warm the cache: sounds are short, and a hit should not wait on a fetch.
    for (const urls of Object.values(AUDIO.sfx)) for (const url of urls) void this.load(url);
    if (this.wanted) this.music(this.wanted);
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.hidden ? 0 : this.volumes.master, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      p = (async () => {
        try {
          const res = await fetch(`/${url}`);
          if (!res.ok) throw new Error(String(res.status));
          return await this.ctx!.decodeAudioData(await res.arrayBuffer());
        } catch (err) {
          console.warn(`audio: could not load ${url}`, err);
          return null;
        }
      })();
      this.buffers.set(url, p);
    }
    return p;
  }

  /** The music key playing now, if any. */
  get playing(): string | null {
    return this.current?.key ?? null;
  }

  /** Play a sound effect now, if there is a file for it and audio is unlocked. */
  play(id: SfxId, opts: PlayOptions = {}): void {
    const urls = AUDIO.sfx[id];
    if (!urls || !this.ctx || !this.sfxGain || this.volumes.sfx === 0) return;
    const url = urls[Math.floor(Math.random() * urls.length)]!;
    void this.load(url).then((buffer) => {
      if (!buffer || !this.ctx || !this.sfxGain) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const spread = opts.spread ?? 0.04;
      source.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * spread);
      const gain = this.ctx.createGain();
      gain.gain.value = opts.volume ?? 1;
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start();
    });
  }

  /** Crossfade to a music track, or to silence with null. Same key: nothing happens. */
  music(key: string | null): void {
    this.wanted = key;
    if (!this.ctx || !this.musicGain) return;
    if (this.current?.key === key) return;
    const ctx = this.ctx;
    const old = this.current;
    this.current = null;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, CROSSFADE / 3);
      old.source.stop(ctx.currentTime + CROSSFADE);
    }
    const entry = key ? AUDIO.music[key] : undefined;
    if (!key || !entry) return;
    void this.load(entry.url).then((buffer) => {
      // The scene may have moved on while the file loaded.
      if (!buffer || this.wanted !== key || !this.musicGain) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      if (entry.loopStart !== undefined) source.loopStart = entry.loopStart;
      if (entry.loopEnd !== undefined) source.loopEnd = entry.loopEnd;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, ctx.currentTime, CROSSFADE / 3);
      source.connect(gain);
      gain.connect(this.musicGain);
      source.start();
      this.current = { key, source, gain };
    });
  }
}

let service: AudioService | null = null;

/** Called once at boot. */
export function initAudio(settings: SettingsStore): void {
  service = new AudioService(settings);
}

const silent = { play(): void {}, music(): void {}, playing: null };

/** The audio service, or a silent stand-in before boot (and in tests). */
export function audio(): Pick<AudioService, 'play' | 'music' | 'playing'> {
  return service ?? silent;
}
