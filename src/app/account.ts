import { hasProgress, mergeProfiles, parseProfile, type Profile } from '../engine/meta/profile';
import { profileStore } from './profile';
import { runController } from './runController';

/**
 * The signed-in player, and the mirror of their Tome and run on the server.
 * Playing signed out never touches this. Signed in, the browser still plays
 * the game; every save is pushed a moment later, sign-in pulls and merges,
 * and a lost connection just means "will sync" until it comes back.
 */

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** What the anonymous Tome would bring into an account, for the prompt. */
export interface CarryOffer {
  lore: number;
  pages: number;
  bestiary: number;
  runFloor: number | null;
}

/** Boot waits on `/api/me`, so no request may hang: a stalled fetch counts as offline. */
const TIMEOUT_MS = 15000;

function timeoutSignal(): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(TIMEOUT_MS);
  } catch {
    return undefined;
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: timeoutSignal(),
    });
  } catch {
    throw new ApiError(0, 'No connection. Your progress is safe on this device and will sync later.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`);
  return data;
}

const RUN_AT_KEY = (userId: string) => `tome.run.u.${userId}.at`;

class AccountStore {
  user: User | null = null;
  sync: SyncState = 'idle';
  lastSyncAt: number | null = null;
  private listeners = new Set<() => void>();
  private pendingProfile: Profile | null = null;
  private pendingRun: { doc: unknown | null } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing = false;

  constructor() {
    profileStore().onSave = (profile, userId) => {
      if (this.user && userId === this.user.id) this.queue({ profile });
    };
    runController().onSave = (doc, userId) => {
      if (this.user && userId === this.user.id) {
        try {
          window.localStorage.setItem(RUN_AT_KEY(userId), String(Date.now()));
        } catch {
          // ignore
        }
        this.queue({ run: doc });
      }
    };
    window.addEventListener('online', () => void this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush(true);
    });
  }

  on(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private setSync(s: SyncState): void {
    this.sync = s;
    if (s === 'synced') this.lastSyncAt = Date.now();
    this.emit();
  }

  // ---------------------------------------------------------------- session

  /** At boot: who is signed in, if anyone, and pull their Tome. */
  async init(): Promise<void> {
    try {
      const { user } = await api<{ user: User }>('GET', '/api/me');
      await this.enter(user, true);
    } catch (e) {
      // 401 is the ordinary signed-out state; anything else means offline, which is also fine.
      if (e instanceof ApiError && e.status !== 401 && e.status !== 0) console.warn('account: could not check the session', e);
    }
  }

  /** Sign up. The anonymous Tome and run become this account's. */
  async signup(fields: { username: string; email: string; password: string }): Promise<void> {
    const ps = profileStore();
    const anon = ps.anonymous();
    const anonRun = runController().anonymousRaw();
    const carry = hasProgress(anon);
    const { user } = await api<{ user: User }>('POST', '/api/auth/signup', {
      ...fields,
      profile: carry ? anon : undefined,
      run: carry && anonRun ? anonRun : undefined,
    });
    if (carry) ps.markCarried(user.id);
    // Seed the account's local copy from what was just uploaded; no pull needed.
    this.user = user;
    ps.switchUser(user.id);
    runController().switchUser(user.id);
    if (carry) {
      ps.replace(anon);
      if (anonRun) runController().adopt(anonRun);
    }
    this.setSync('synced');
  }

  /** Sign in, pull and merge. Returns a carry offer when this browser holds an anonymous Tome not yet tied to any account. */
  async login(fields: { login: string; password: string }): Promise<CarryOffer | null> {
    const { user } = await api<{ user: User }>('POST', '/api/auth/login', fields);
    await this.enter(user, true);
    return this.carryOffer();
  }

  async logout(): Promise<void> {
    await this.flush(true);
    try {
      await api('POST', '/api/auth/logout');
    } catch {
      // The cookie may already be gone; the local state matters more.
    }
    this.user = null;
    profileStore().switchUser(null);
    runController().switchUser(null);
    this.setSync('idle');
  }

  async requestReset(email: string): Promise<void> {
    await api('POST', '/api/auth/request-reset', { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await api('POST', '/api/auth/reset-password', { token, password });
  }

  async verify(token: string): Promise<void> {
    await api('POST', '/api/auth/verify', { token });
    if (this.user) {
      this.user = { ...this.user, emailVerified: true };
      this.emit();
    }
  }

  async resendVerify(): Promise<void> {
    await api('POST', '/api/auth/resend-verify');
  }

  async deleteAccount(password: string): Promise<void> {
    await api('DELETE', '/api/account', { password });
    this.user = null;
    profileStore().switchUser(null);
    runController().switchUser(null);
    this.setSync('idle');
  }

  // ---------------------------------------------------------------- carrying the anonymous Tome

  /** What the anonymous Tome holds, or null if it is empty or already carried into an account. */
  anonymousSummary(): CarryOffer | null {
    const ps = profileStore();
    const anon = ps.anonymous();
    if (!hasProgress(anon) || ps.carriedTo()) return null;
    const run = runController().anonymousRaw() as { stats?: { floorsClimbed?: number }; phase?: string } | null;
    const inProgress = run && run.phase !== 'won' && run.phase !== 'lost';
    return {
      lore: anon.lore,
      pages: anon.pages.length,
      bestiary: Object.values(anon.bestiary).filter((b) => b.kills > 0).length,
      runFloor: inProgress ? run.stats?.floorsClimbed ?? 0 : null,
    };
  }

  /** The anonymous Tome as an offer to the signed-in account, unless this account already declined it. */
  carryOffer(): CarryOffer | null {
    if (!this.user || profileStore().declined(this.user.id)) return null;
    return this.anonymousSummary();
  }

  acceptCarry(): void {
    if (!this.user) return;
    const ps = profileStore();
    const anon = ps.anonymous();
    ps.replace(mergeProfiles(ps.profile, anon));
    const rc = runController();
    if (!rc.run) {
      const anonRun = rc.anonymousRaw();
      if (anonRun) rc.adopt(anonRun);
    }
    ps.markCarried(this.user.id);
    this.emit();
  }

  declineCarry(): void {
    if (this.user) profileStore().markDeclined(this.user.id);
  }

  // ---------------------------------------------------------------- sync

  private async enter(user: User, pull: boolean): Promise<void> {
    this.user = user;
    const ps = profileStore();
    const rc = runController();
    ps.switchUser(user.id);
    rc.switchUser(user.id);
    this.emit();
    if (!pull) return;
    this.setSync('syncing');
    try {
      const [p, r] = await Promise.all([
        api<{ profile: unknown; updatedAt: number | null }>('GET', '/api/profile'),
        api<{ run: unknown; updatedAt: number | null }>('GET', '/api/run'),
      ]);
      // The Tome: the union of what the server has and what this device has.
      const server = p.profile ? parseProfile(p.profile) : null;
      const merged = server ? mergeProfiles(ps.profile, server) : ps.profile;
      const changed = JSON.stringify(merged) !== JSON.stringify(server);
      ps.profile = merged;
      ps.save(); // queues a push only if it differs from the server's copy
      if (!changed) this.pendingProfile = null;
      // The run: whichever copy was saved last.
      const localAt = Number(window.localStorage.getItem(RUN_AT_KEY(user.id)) ?? 0);
      if (r.run && (!rc.run || (r.updatedAt ?? 0) > localAt)) {
        rc.adopt(r.run);
        this.pendingRun = null;
      } else if (!r.run && rc.run) {
        this.queue({ run: rc.run ? JSON.parse(JSON.stringify(rc.run)) : null });
      }
      await this.flush(true);
      this.setSync('synced');
    } catch (e) {
      console.warn('account: sync failed', e);
      this.setSync('offline');
    }
  }

  private queue(what: { profile?: Profile; run?: unknown | null }): void {
    if (what.profile) this.pendingProfile = what.profile;
    if ('run' in what) this.pendingRun = { doc: what.run ?? null };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 1500);
    if (this.sync !== 'offline') this.setSync('syncing');
  }

  /** Push whatever is waiting. `now` skips the debounce (sign-out, tab hidden). */
  async flush(now = false): Promise<void> {
    if (!this.user || this.flushing) return;
    if (!now) clearTimeout(this.timer);
    const profile = this.pendingProfile;
    const run = this.pendingRun;
    if (!profile && !run) return;
    this.flushing = true;
    try {
      if (profile) {
        this.pendingProfile = null;
        await api('PUT', '/api/profile', { profile });
      }
      if (run) {
        this.pendingRun = null;
        if (run.doc) await api('PUT', '/api/run', { run: run.doc });
        else await api('DELETE', '/api/run');
      }
      this.setSync('synced');
    } catch (e) {
      // Keep it for next time.
      if (profile && !this.pendingProfile) this.pendingProfile = profile;
      if (run && !this.pendingRun) this.pendingRun = run;
      if (e instanceof ApiError && e.status === 401) {
        // The session died (password reset elsewhere, or expired): back to the anonymous Tome.
        this.user = null;
        profileStore().switchUser(null);
        runController().switchUser(null);
        this.setSync('idle');
      } else this.setSync('offline');
    } finally {
      this.flushing = false;
    }
  }
}

let instance: AccountStore | null = null;

export function account(): AccountStore {
  instance ??= new AccountStore();
  return instance;
}
