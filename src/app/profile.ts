import { defaultProfile, parseProfile, type Profile } from '../engine/meta/profile';

export const PROFILE_KEY = 'tome.profile.v1';

/**
 * The one Tome in this browser. Engine functions mutate `profile`; call
 * `save()` after. Lost storage is survivable: the profile lives in memory
 * for the session and is simply not kept.
 */
class ProfileStore {
  profile: Profile;
  private storage: Storage | null;

  constructor() {
    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = null;
    }
    let raw: string | null;
    try {
      raw = this.storage?.getItem(PROFILE_KEY) ?? null;
    } catch {
      raw = null;
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    this.profile = parsed ? parseProfile(parsed) : defaultProfile();
  }

  save(): void {
    try {
      this.storage?.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    } catch (err) {
      console.warn('profile: could not save', err);
    }
  }

  /** Replace the whole Tome (a loaded save code). */
  replace(profile: Profile): void {
    this.profile = profile;
    this.save();
  }

  reset(): void {
    this.replace(defaultProfile());
  }
}

let instance: ProfileStore | null = null;

export function profileStore(): ProfileStore {
  instance ??= new ProfileStore();
  return instance;
}
