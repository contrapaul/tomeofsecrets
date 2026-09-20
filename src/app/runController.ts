import { loadContent, type ContentRegistry } from '../content';
import { recordFight, recordRun, unlocks, type RunLedger } from '../engine/meta/profile';
import { formatSeed } from '../engine/rng';
import { createRun, finishFight, reviveRun, serializeRun, type RunSetup, type RunState } from '../engine/run/run';
import { profileStore } from './profile';

export const RUN_KEY = 'tome.run.v1';

/** Where the run in progress lives: the anonymous one, or an account's local copy. */
export function runKey(userId: string | null): string {
  return userId ? `tome.run.u.${userId}` : RUN_KEY;
}

/**
 * The one run in progress. Scenes read `run`, call engine functions on it,
 * then `save()`. Every run route reads `route()` to know where the run wants
 * to be, so a reload lands on the right screen.
 */
class RunController {
  run: RunState | null = null;
  userId: string | null = null;
  readonly content: ContentRegistry = loadContent();
  /** Called after every save, with the JSON-safe run or null when cleared; the account module pushes from here. */
  onSave: ((run: unknown | null, userId: string | null) => void) | null = null;
  private storage: Storage | null;

  constructor() {
    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = null;
    }
    this.load();
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(runKey(this.userId));
      this.run = raw ? reviveRun(this.content, JSON.parse(raw)) : null;
    } catch (err) {
      console.warn('run: could not load the saved run', err);
      this.run = null;
    }
  }

  /** Load the run for this account (or the anonymous one for null). */
  switchUser(userId: string | null): void {
    this.userId = userId;
    this.load();
  }

  /** Take a run document from elsewhere (the server) as the current run. */
  adopt(data: unknown | null): void {
    try {
      this.run = data ? reviveRun(this.content, data) : null;
    } catch (err) {
      console.warn('run: could not adopt the run', err);
      this.run = null;
    }
    if (this.run) this.save();
    else this.clear();
  }

  /** The anonymous run's raw document, whoever is signed in. */
  anonymousRaw(): unknown | null {
    try {
      const raw = this.storage?.getItem(runKey(null));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  hasSave(): boolean {
    return !!this.run && this.run.phase !== 'won' && this.run.phase !== 'lost';
  }

  /** Start a run from the character-select choices; the Tome supplies the pools and the known pages. */
  newRun(choices: Omit<RunSetup, 'seed' | 'pool' | 'known'>, seed?: string): RunState {
    const s = seed?.trim() || formatSeed((Math.random() * 0xffffffff) >>> 0);
    const profile = profileStore().profile;
    const u = unlocks(profile, this.content);
    this.run = createRun(this.content, {
      ...choices,
      seed: s,
      pool: { cards: [...u.cards], relics: [...u.relics] },
      known: Object.entries(profile.bestiary).filter(([, b]) => b.kills > 0).map(([id]) => id),
    });
    this.save();
    return this.run;
  }

  /** The fight is over: the Tome remembers it, then the run moves on. */
  finishFight(): void {
    const run = this.run;
    if (!run?.fight) return;
    const store = profileStore();
    recordFight(store.profile, run.fight.state);
    finishFight(run, this.content);
    store.save();
    this.save();
  }

  lore(): number {
    return profileStore().profile.lore;
  }

  /** Bank an ended run (won, lost, or abandoned) exactly once. */
  settle(): RunLedger | null {
    const run = this.run;
    if (!run) return null;
    const store = profileStore();
    const ledger = recordRun(store.profile, run, new Date().toISOString());
    store.save();
    this.save();
    return ledger;
  }

  save(): void {
    if (!this.run) return;
    const doc = serializeRun(this.run);
    try {
      this.storage?.setItem(runKey(this.userId), JSON.stringify(doc));
    } catch (err) {
      console.warn('run: could not save', err);
    }
    this.onSave?.(doc, this.userId);
  }

  clear(): void {
    this.run = null;
    try {
      this.storage?.removeItem(runKey(this.userId));
    } catch {
      // nothing to do
    }
    this.onSave?.(null, this.userId);
  }

  /** The hash route for the run's current phase. */
  route(): string {
    const r = this.run;
    if (!r) return '/run/new';
    switch (r.phase) {
      case 'map': return '/run/map';
      case 'fight': return '/run/fight';
      case 'reward': return '/run/reward';
      case 'shop': return '/run/shop';
      case 'camp': return '/run/camp';
      case 'event': return '/run/event';
      case 'treasure': return '/run/treasure';
      case 'bossReward': return '/run/boss-reward';
      case 'won':
      case 'lost': return '/run/end';
    }
  }
}

let instance: RunController | null = null;

export function runController(): RunController {
  instance ??= new RunController();
  return instance;
}
