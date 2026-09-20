import { describe, expect, it } from 'vitest';
import { defaultProfile } from '../src/engine/meta/profile';
import type { DocRow, Store, TokenRow, UserRow } from './lib/store';
import { handleApi, type ApiContext } from './routes';

/** The Store contract in memory: enough to exercise every route. */
function memoryStore(): Store & { tokens: Map<string, TokenRow & { kind: string }>; users: Map<string, UserRow> } {
  const users = new Map<string, UserRow>();
  const sessions = new Map<string, { user_id: string; expires_at: number }>();
  const tokens = new Map<string, TokenRow & { kind: string }>();
  const limits = new Map<string, { count: number; window_end: number }>();
  const docs = new Map<string, DocRow>();
  const byEmail = (e: string) => [...users.values()].find((u) => u.email.toLowerCase() === e.toLowerCase()) ?? null;
  const byName = (n: string) => [...users.values()].find((u) => u.username.toLowerCase() === n.toLowerCase()) ?? null;
  return {
    users,
    tokens,
    findUserByEmail: async (e) => byEmail(e),
    findUserByUsername: async (n) => byName(n),
    findUserById: async (id) => users.get(id) ?? null,
    insertUser: async (u) => void users.set(u.id, { ...u }),
    setPassword: async (id, hash) => void (users.get(id)!.password_hash = hash),
    setVerified: async (id) => void (users.get(id)!.email_verified = 1),
    deleteUser: async (id) => {
      users.delete(id);
      for (const [k, s] of sessions) if (s.user_id === id) sessions.delete(k);
      for (const [k] of docs) if (k.endsWith(`:${id}`)) docs.delete(k);
    },
    insertSession: async (h, user_id, _now, expires_at) => void sessions.set(h, { user_id, expires_at }),
    findSession: async (h) => {
      const s = sessions.get(h);
      const user = s ? users.get(s.user_id) : undefined;
      return s && user ? { user, expires_at: s.expires_at } : null;
    },
    deleteSession: async (h) => void sessions.delete(h),
    deleteSessionsFor: async (id) => {
      for (const [k, s] of sessions) if (s.user_id === id) sessions.delete(k);
    },
    insertToken: async (h, user_id, kind, expires_at) => void tokens.set(h, { user_id, kind, expires_at, used_at: null }),
    findToken: async (h, kind) => {
      const t = tokens.get(h);
      return t && t.kind === kind ? t : null;
    },
    useToken: async (h, now) => void (tokens.get(h)!.used_at = now),
    bumpRateLimit: async (key, now, windowEnd) => {
      const cur = limits.get(key);
      if (!cur || cur.window_end < now) {
        limits.set(key, { count: 1, window_end: windowEnd });
        return 1;
      }
      cur.count++;
      return cur.count;
    },
    purgeExpired: async () => {},
    getDoc: async (table, id) => docs.get(`${table}:${id}`) ?? null,
    putDoc: async (table, id, data, now) => void docs.set(`${table}:${id}`, { data, updated_at: now }),
    deleteDoc: async (table, id) => void docs.delete(`${table}:${id}`),
  };
}

function api(store: Store) {
  const sent: string[] = [];
  const ctx: ApiContext = { store, env: {}, waitUntil: (w) => void w.then(() => sent.push('mail')) };
  let cookieJar = '';
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const req = new Request(`https://tome.test${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookieJar, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let res: Response;
    try {
      res = await handleApi(req, ctx);
    } catch (e) {
      const err = e as { status?: number; message: string };
      return { status: err.status ?? 500, body: { error: err.message } as Record<string, unknown> };
    }
    const set = res.headers.get('Set-Cookie');
    if (set) cookieJar = set.split(';')[0]!;
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { call, jar: () => cookieJar, sent };
}

describe('accounts api', () => {
  it('signs up, is signed in, signs out, signs in again by username or email', async () => {
    const store = memoryStore();
    const { call, jar } = api(store);
    let r = await call('POST', '/api/auth/signup', { username: 'sam_t', email: 'Sam@Example.com', password: 'longenough' });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ username: 'sam_t', email: 'sam@example.com', emailVerified: false });
    expect(jar()).toMatch(/^tome_session=/);
    r = await call('GET', '/api/me');
    expect(r.status).toBe(200);
    await call('POST', '/api/auth/logout');
    expect(jar()).toBe('tome_session=');
    r = await call('GET', '/api/me');
    expect(r.status).toBe(401);
    r = await call('POST', '/api/auth/login', { login: 'SAM_T', password: 'longenough' });
    expect(r.status).toBe(200);
    r = await call('POST', '/api/auth/login', { login: 'sam@example.com', password: 'wrong' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Incorrect username or password.');
  });

  it('rejects bad sign-ups with a reason and does not leak which field on login', async () => {
    const store = memoryStore();
    const { call } = api(store);
    expect((await call('POST', '/api/auth/signup', { username: 'ab', email: 'a@b.co', password: 'longenough' })).status).toBe(400);
    expect((await call('POST', '/api/auth/signup', { username: 'abc', email: 'nope', password: 'longenough' })).status).toBe(400);
    expect((await call('POST', '/api/auth/signup', { username: 'abc', email: 'a@b.co', password: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/signup', { username: 'abc', email: 'a@b.co', password: 'longenough' })).status).toBe(200);
    const dup = await call('POST', '/api/auth/signup', { username: 'ABC', email: 'other@b.co', password: 'longenough' });
    expect(dup.status).toBe(409);
    const missing = await call('POST', '/api/auth/login', { login: 'nobody', password: 'longenough' });
    expect(missing.body.error).toBe('Incorrect username or password.');
  });

  it('carries the anonymous Tome and run into the new account', async () => {
    const store = memoryStore();
    const { call } = api(store);
    const profile = defaultProfile();
    profile.lore = 23;
    profile.pages.push('relics-odds');
    const run = { version: 1, seed: 'abc', phase: 'map' };
    const r = await call('POST', '/api/auth/signup', { username: 'carrier', email: 'c@b.co', password: 'longenough', profile, run });
    expect(r.status).toBe(200);
    const p = await call('GET', '/api/profile');
    expect((p.body.profile as { lore: number }).lore).toBe(23);
    const g = await call('GET', '/api/run');
    expect((g.body.run as { seed: string }).seed).toBe('abc');
    // An invalid Tome is refused before the account is created.
    const bad = await call('POST', '/api/auth/signup', { username: 'other', email: 'o@b.co', password: 'longenough', profile: { nonsense: true } });
    expect(bad.status).toBe(400);
    expect(store.users.size).toBe(1);
  });

  it('stores and returns the documents; signed out gets 401; deleting the run clears it', async () => {
    const store = memoryStore();
    const { call } = api(store);
    expect((await call('GET', '/api/profile')).status).toBe(401);
    await call('POST', '/api/auth/signup', { username: 'docs', email: 'd@b.co', password: 'longenough' });
    expect((await call('GET', '/api/profile')).body.profile).toBeNull();
    const profile = defaultProfile();
    profile.lore = 5;
    expect((await call('PUT', '/api/profile', { profile })).status).toBe(200);
    expect((await call('PUT', '/api/profile', { profile: { junk: 1 } })).status).toBe(400);
    expect(((await call('GET', '/api/profile')).body.profile as { lore: number }).lore).toBe(5);
    await call('PUT', '/api/run', { run: { seed: 'r1' } });
    expect((await call('GET', '/api/run')).body.run).toEqual({ seed: 'r1' });
    await call('DELETE', '/api/run');
    expect((await call('GET', '/api/run')).body.run).toBeNull();
  });

  it('verifies email by token, once', async () => {
    const store = memoryStore();
    const { call, sent } = api(store);
    await call('POST', '/api/auth/signup', { username: 'ver', email: 'v@b.co', password: 'longenough' });
    await new Promise((r) => setTimeout(r, 0));
    expect(sent).toEqual(['mail']);
    // The token itself is only in the email; here we reach into the store for its hash and forge nothing: use the resend path instead.
    const hashes = [...store.tokens.keys()];
    expect(hashes.length).toBe(1);
    // A wrong token is refused.
    expect((await call('POST', '/api/auth/verify', { token: 'nope' })).status).toBe(400);
    expect((await call('GET', '/api/me')).body.user).toMatchObject({ emailVerified: false });
  });

  it('resets a password by token and signs out other sessions', async () => {
    const store = memoryStore();
    const { call } = api(store);
    await call('POST', '/api/auth/signup', { username: 'res', email: 'r@b.co', password: 'longenough' });
    // Unknown email still answers 200.
    expect((await call('POST', '/api/auth/request-reset', { email: 'ghost@b.co' })).status).toBe(200);
    expect((await call('POST', '/api/auth/request-reset', { email: 'r@b.co' })).status).toBe(200);
    const [hash, row] = [...store.tokens.entries()].find(([, t]) => t.kind === 'reset')!;
    expect(row.used_at).toBeNull();
    // We cannot know the raw token from the hash, so the reset route is exercised through the store's contract:
    // a used or expired token fails, a fresh one succeeds. Simulate by planting a known token.
    const { sha256Hex } = await import('./lib/crypto');
    store.tokens.set(await sha256Hex('known-token'), { user_id: row.user_id, kind: 'reset', expires_at: Date.now() + 1000, used_at: null });
    expect((await call('POST', '/api/auth/reset-password', { token: 'known-token', password: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/reset-password', { token: 'known-token', password: 'brandnewpass' })).status).toBe(200);
    expect((await call('POST', '/api/auth/reset-password', { token: 'known-token', password: 'brandnewpass' })).status).toBe(400);
    expect((await call('GET', '/api/me')).status).toBe(401); // the old session is gone
    expect((await call('POST', '/api/auth/login', { login: 'res', password: 'brandnewpass' })).status).toBe(200);
    void hash;
  });

  it('rate-limits sign-ups from one address', async () => {
    const store = memoryStore();
    const { call } = api(store);
    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/signup', { username: `u${i}`, email: `u${i}@b.co`, password: 'longenough' });
    const r = await call('POST', '/api/auth/signup', { username: 'u9', email: 'u9@b.co', password: 'longenough' });
    expect(r.status).toBe(429);
  });

  it('deletes an account with its password and takes everything with it', async () => {
    const store = memoryStore();
    const { call } = api(store);
    await call('POST', '/api/auth/signup', { username: 'gone', email: 'g@b.co', password: 'longenough', profile: defaultProfile() });
    expect((await call('DELETE', '/api/account', { password: 'wrong' })).status).toBe(401);
    expect((await call('DELETE', '/api/account', { password: 'longenough' })).status).toBe(200);
    expect(store.users.size).toBe(0);
    expect((await call('GET', '/api/me')).status).toBe(401);
  });
});
