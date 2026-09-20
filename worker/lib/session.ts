import { randomToken, sha256Hex } from './crypto';
import type { Store, UserRow } from './store';

/**
 * Sessions, ported from flashstone/src/lib/server/session.ts. The token is
 * random, only its SHA-256 is stored, and the cookie is HttpOnly + Secure +
 * SameSite=Lax. Thirty days.
 */

export const SESSION_COOKIE = 'tome_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(store: Store, userId: string, now = Date.now()): Promise<string> {
  const token = randomToken();
  await store.insertSession(await sha256Hex(token), userId, now, now + SESSION_TTL_MS);
  return token;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function userFromToken(store: Store, token: string | null, now = Date.now()): Promise<UserRow | null> {
  if (!token) return null;
  const row = await store.findSession(await sha256Hex(token));
  if (!row || row.expires_at < now) return null;
  return row.user;
}

export async function deleteSession(store: Store, token: string | null): Promise<void> {
  if (token) await store.deleteSession(await sha256Hex(token));
}
