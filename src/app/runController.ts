import { loadContent, type ContentRegistry } from '../content';
import type { ClassId } from '../content/schema';
import { formatSeed } from '../engine/rng';
import { createRun, reviveRun, serializeRun, type RunState } from '../engine/run/run';

export const RUN_KEY = 'tome.run.v1';

/**
 * The one run in progress. Scenes read `run`, call engine functions on it,
 * then `save()`. Every run route reads `route()` to know where the run wants
 * to be, so a reload lands on the right screen.
 */
class RunController {
  run: RunState | null = null;
  readonly content: ContentRegistry = loadContent();
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
      const raw = this.storage?.getItem(RUN_KEY);
      if (raw) this.run = reviveRun(this.content, JSON.parse(raw));
    } catch (err) {
      console.warn('run: could not load the saved run', err);
      this.run = null;
    }
  }

  hasSave(): boolean {
    return !!this.run && this.run.phase !== 'won' && this.run.phase !== 'lost';
  }

  newRun(classId: ClassId, seed?: string): RunState {
    const s = seed?.trim() || formatSeed((Math.random() * 0xffffffff) >>> 0);
    this.run = createRun(this.content, { classId, seed: s });
    this.save();
    return this.run;
  }

  save(): void {
    if (!this.run) return;
    try {
      this.storage?.setItem(RUN_KEY, JSON.stringify(serializeRun(this.run)));
    } catch (err) {
      console.warn('run: could not save', err);
    }
  }

  clear(): void {
    this.run = null;
    try {
      this.storage?.removeItem(RUN_KEY);
    } catch {
      // nothing to do
    }
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
