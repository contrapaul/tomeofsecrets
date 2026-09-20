import { defaultProfile, parseProfile, type Profile } from '../engine/meta/profile';

export const PROFILE_KEY = 'tome.profile.v1';
const CARRIED_KEY = 'tome.profile.carried';

/** Where a Tome lives: the anonymous one, or an account's local copy. */
export function profileKey(userId: string | null): string {
  return userId ? `tome.profile.u.${userId}` : PROFILE_KEY;
}

/**
 * The Tome in this browser. Engine functions mutate `profile`; call `save()`
 * after. Signed out, that is the anonymous Tome; signed in, it is the
 * account's local copy, which the account module mirrors to the server. The
 * two never overwrite each other, so signing out returns exactly to where the
 * anonymous Tome was. Lost storage is survivable: the profile lives in memory
 * for the session and is simply not kept.
 */
class ProfileStore {
  profile: Profile;
  userId: string | null = null;
  /** Called after every save; the account module pushes from here. */
  onSave: ((profile: Profile, userId: string | null) => void) | null = null;
  private storage: Storage | null;

  constructor() {
    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = null;
    }
    this.profile = this.read(profileKey(null));
  }

  private read(key: string): Profile {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(key) ?? null;
    } catch {
      raw = null;
    }
    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    return parsed ? parseProfile(parsed) : defaultProfile();
  }

  private write(key: string, profile: Profile): void {
    try {
      this.storage?.setItem(key, JSON.stringify(profile));
    } catch (err) {
      console.warn('profile: could not save', err);
    }
  }

  save(): void {
    this.write(profileKey(this.userId), this.profile);
    this.onSave?.(this.profile, this.userId);
  }

  /** Replace the whole Tome (a loaded save code, or the server's copy). */
  replace(profile: Profile): void {
    this.profile = profile;
    this.save();
  }

  reset(): void {
    this.replace(defaultProfile());
  }

  /** Load the Tome for this account (or the anonymous one for null). */
  switchUser(userId: string | null): void {
    this.userId = userId;
    this.profile = this.read(profileKey(userId));
  }

  /** The anonymous Tome, whoever is signed in. */
  anonymous(): Profile {
    return this.read(profileKey(null));
  }

  /** Which account the anonymous Tome was carried into, if any. */
  carriedTo(): string | null {
    try {
      return this.storage?.getItem(CARRIED_KEY) ?? null;
    } catch {
      return null;
    }
  }

  markCarried(userId: string): void {
    try {
      this.storage?.setItem(CARRIED_KEY, userId);
    } catch {
      // ignore
    }
  }

  /** Remember that this account declined the anonymous Tome, so it is not asked again. */
  declined(userId: string): boolean {
    try {
      return this.storage?.getItem(`tome.profile.declined.${userId}`) === '1';
    } catch {
      return false;
    }
  }

  markDeclined(userId: string): void {
    try {
      this.storage?.setItem(`tome.profile.declined.${userId}`, '1');
    } catch {
      // ignore
    }
  }
}

let instance: ProfileStore | null = null;

export function profileStore(): ProfileStore {
  instance ??= new ProfileStore();
  return instance;
}
