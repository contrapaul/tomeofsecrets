import { Profile } from '../src/content/schema/meta';
import { hashPassword, randomToken, sha256Hex, verifyPassword } from './lib/crypto';
import { sendResetEmail, sendVerifyEmail, type EmailEnv } from './lib/email';
import { clientIp, cookie, fail, json, MAX_DOC_BYTES, readJson } from './lib/http';
import { rateLimit } from './lib/ratelimit';
import { clearedSessionCookie, createSession, deleteSession, SESSION_COOKIE, sessionCookie, userFromToken } from './lib/session';
import type { Store, UserRow } from './lib/store';

/**
 * The account API (docs/plans.md Phase 6.3). Username, email, password;
 * hashed sessions in a cookie; verify and reset tokens; the Tome and the run
 * in progress as two documents the browser owns and the server keeps.
 */

export interface ApiContext {
  store: Store;
  env: EmailEnv;
  /** Run work after the response, when the platform allows. */
  waitUntil: (work: Promise<unknown>) => void;
  now?: () => number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, email: u.email, emailVerified: !!u.email_verified };
}

async function requireUser(ctx: ApiContext, request: Request): Promise<UserRow> {
  const user = await userFromToken(ctx.store, cookie(request, SESSION_COOKIE), ctx.now?.());
  if (!user) fail(401, 'Sign in required.');
  return user;
}

/** A stored document: JSON under the size cap. Profiles must also be a valid Tome. */
function docString(value: unknown, kind: 'profile' | 'run'): string {
  if (kind === 'profile' && !Profile.safeParse(value).success) fail(400, 'That is not a valid Tome.');
  if (kind === 'run' && (!value || typeof value !== 'object')) fail(400, 'That is not a valid run.');
  const s = JSON.stringify(value);
  if (s.length > MAX_DOC_BYTES) fail(413, 'That document is too large.');
  return s;
}

async function issueVerifyToken(ctx: ApiContext, user: UserRow, origin: string): Promise<void> {
  const token = randomToken();
  const now = ctx.now?.() ?? Date.now();
  await ctx.store.insertToken(await sha256Hex(token), user.id, 'verify', now + DAY);
  ctx.waitUntil(sendVerifyEmail(ctx.env, user.email, `${origin}/?verify=${token}`));
}

export async function handleApi(request: Request, ctx: ApiContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  const now = ctx.now?.() ?? Date.now();
  const store = ctx.store;
  const route = `${method} ${path}`;

  switch (route) {
    case 'POST /api/auth/signup': {
      await rateLimit(store, `signup:${clientIp(request)}`, 5, HOUR, now);
      const body = await readJson(request);
      const email = String(body.email ?? '').trim().toLowerCase();
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      if (!EMAIL_RE.test(email) || email.length > 254) fail(400, 'Please enter a valid email address.');
      if (!USERNAME_RE.test(username)) fail(400, 'Username must be 3–24 characters: letters, numbers, - or _ only.');
      if (password.length < 8 || password.length > 200) fail(400, 'Password must be at least 8 characters.');
      if (await store.findUserByEmail(email)) fail(409, 'That email already has an account. Sign in instead.');
      if (await store.findUserByUsername(username)) fail(409, 'That username is taken.');
      // The anonymous Tome and run come along, validated like any other document.
      const profileDoc = body.profile !== undefined && body.profile !== null ? docString(body.profile, 'profile') : null;
      const runDoc = body.run !== undefined && body.run !== null ? docString(body.run, 'run') : null;
      const user: UserRow = { id: crypto.randomUUID(), username, email, password_hash: await hashPassword(password), email_verified: 0, created_at: now };
      await store.insertUser(user);
      if (profileDoc) await store.putDoc('profiles', user.id, profileDoc, now);
      if (runDoc) await store.putDoc('run_saves', user.id, runDoc, now);
      await issueVerifyToken(ctx, user, url.origin);
      const session = await createSession(store, user.id, now);
      return json({ user: publicUser(user) }, { headers: { 'Set-Cookie': sessionCookie(session) } });
    }

    case 'POST /api/auth/login': {
      const body = await readJson(request);
      const login = String(body.login ?? body.email ?? '').trim();
      const password = String(body.password ?? '');
      await rateLimit(store, `login:${clientIp(request)}`, 10, 15 * 60 * 1000, now);
      await rateLimit(store, `login:${login.toLowerCase()}`, 10, 15 * 60 * 1000, now);
      const user = login.includes('@') ? await store.findUserByEmail(login.toLowerCase()) : await store.findUserByUsername(login);
      // One message for both cases, so a wrong password cannot confirm an account.
      if (!user || !(await verifyPassword(password, user.password_hash))) fail(401, 'Incorrect username or password.');
      ctx.waitUntil(store.purgeExpired(user.id, now));
      const session = await createSession(store, user.id, now);
      return json({ user: publicUser(user) }, { headers: { 'Set-Cookie': sessionCookie(session) } });
    }

    case 'POST /api/auth/logout': {
      await deleteSession(store, cookie(request, SESSION_COOKIE));
      return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } });
    }

    case 'GET /api/me': {
      const user = await requireUser(ctx, request);
      return json({ user: publicUser(user) });
    }

    case 'POST /api/auth/verify': {
      const body = await readJson(request);
      const token = String(body.token ?? '');
      if (!token) fail(400, 'Missing token.');
      const hash = await sha256Hex(token);
      const row = await store.findToken(hash, 'verify');
      if (!row || row.used_at || row.expires_at < now) fail(400, 'This verification link is invalid or has expired.');
      await store.useToken(hash, now);
      await store.setVerified(row.user_id);
      return json({ ok: true });
    }

    case 'POST /api/auth/resend-verify': {
      const user = await requireUser(ctx, request);
      if (user.email_verified) fail(400, 'Your email is already verified.');
      await rateLimit(store, `resend-verify:${user.id}`, 3, HOUR, now);
      await issueVerifyToken(ctx, user, url.origin);
      return json({ ok: true });
    }

    case 'POST /api/auth/request-reset': {
      // Always 200, so account existence cannot be probed.
      const body = await readJson(request);
      const email = String(body.email ?? '').trim().toLowerCase();
      await rateLimit(store, `reset:${clientIp(request)}`, 5, HOUR, now);
      await rateLimit(store, `reset:${email}`, 3, HOUR, now);
      const user = await store.findUserByEmail(email);
      if (user) {
        const token = randomToken();
        await store.insertToken(await sha256Hex(token), user.id, 'reset', now + HOUR);
        ctx.waitUntil(sendResetEmail(ctx.env, email, `${url.origin}/?reset=${token}`));
      }
      return json({ ok: true });
    }

    case 'POST /api/auth/reset-password': {
      const body = await readJson(request);
      const token = String(body.token ?? '');
      const password = String(body.password ?? '');
      if (!token) fail(400, 'Missing token.');
      if (password.length < 8 || password.length > 200) fail(400, 'Password must be at least 8 characters.');
      const hash = await sha256Hex(token);
      const row = await store.findToken(hash, 'reset');
      if (!row || row.used_at || row.expires_at < now) fail(400, 'This reset link is invalid or has expired. Request a new one.');
      // New password, burn the token, sign out every existing session.
      await store.setPassword(row.user_id, await hashPassword(password));
      await store.useToken(hash, now);
      await store.deleteSessionsFor(row.user_id);
      return json({ ok: true });
    }

    case 'GET /api/profile': {
      const user = await requireUser(ctx, request);
      const doc = await store.getDoc('profiles', user.id);
      return json(doc ? { profile: JSON.parse(doc.data), updatedAt: doc.updated_at } : { profile: null, updatedAt: null });
    }

    case 'PUT /api/profile': {
      const user = await requireUser(ctx, request);
      const body = await readJson(request);
      await store.putDoc('profiles', user.id, docString(body.profile, 'profile'), now);
      return json({ updatedAt: now });
    }

    case 'GET /api/run': {
      const user = await requireUser(ctx, request);
      const doc = await store.getDoc('run_saves', user.id);
      return json(doc ? { run: JSON.parse(doc.data), updatedAt: doc.updated_at } : { run: null, updatedAt: null });
    }

    case 'PUT /api/run': {
      const user = await requireUser(ctx, request);
      const body = await readJson(request);
      await store.putDoc('run_saves', user.id, docString(body.run, 'run'), now);
      return json({ updatedAt: now });
    }

    case 'DELETE /api/run': {
      const user = await requireUser(ctx, request);
      await store.deleteDoc('run_saves', user.id);
      return json({ ok: true });
    }

    case 'DELETE /api/account': {
      const user = await requireUser(ctx, request);
      const body = await readJson(request);
      if (!(await verifyPassword(String(body.password ?? ''), user.password_hash))) fail(401, 'Incorrect password.');
      await store.deleteUser(user.id);
      return json({ ok: true }, { headers: { 'Set-Cookie': clearedSessionCookie() } });
    }

    default:
      fail(404, 'No such route.');
  }
}
