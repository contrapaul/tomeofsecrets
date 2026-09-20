/**
 * Everything the routes ask of the database, as named calls. The D1
 * implementation is thin; tests use an in-memory one with the same shape, so
 * the auth and sync logic is checked without SQL.
 */

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified: number;
  created_at: number;
}

export interface TokenRow {
  user_id: string;
  expires_at: number;
  used_at: number | null;
}

export interface DocRow {
  data: string;
  updated_at: number;
}

export interface Store {
  findUserByEmail(email: string): Promise<UserRow | null>;
  findUserByUsername(username: string): Promise<UserRow | null>;
  findUserById(id: string): Promise<UserRow | null>;
  insertUser(user: UserRow): Promise<void>;
  setPassword(userId: string, hash: string): Promise<void>;
  setVerified(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;

  insertSession(tokenHash: string, userId: string, now: number, expiresAt: number): Promise<void>;
  findSession(tokenHash: string): Promise<{ user: UserRow; expires_at: number } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessionsFor(userId: string): Promise<void>;

  insertToken(tokenHash: string, userId: string, kind: 'verify' | 'reset', expiresAt: number): Promise<void>;
  findToken(tokenHash: string, kind: 'verify' | 'reset'): Promise<TokenRow | null>;
  useToken(tokenHash: string, now: number): Promise<void>;

  /** Fixed-window count for `key`; returns the count within the window after this hit. */
  bumpRateLimit(key: string, now: number, windowEnd: number): Promise<number>;
  purgeExpired(userId: string, now: number): Promise<void>;

  getDoc(table: 'profiles' | 'run_saves', userId: string): Promise<DocRow | null>;
  putDoc(table: 'profiles' | 'run_saves', userId: string, data: string, now: number): Promise<void>;
  deleteDoc(table: 'run_saves', userId: string): Promise<void>;
}

export function d1Store(db: D1Database): Store {
  const user = (row: Record<string, unknown> | null): UserRow | null =>
    row
      ? {
          id: String(row.id),
          username: String(row.username),
          email: String(row.email),
          password_hash: String(row.password_hash),
          email_verified: Number(row.email_verified),
          created_at: Number(row.created_at),
        }
      : null;
  return {
    async findUserByEmail(email) {
      return user(await db.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first());
    },
    async findUserByUsername(username) {
      return user(await db.prepare('SELECT * FROM users WHERE username = ?1').bind(username).first());
    },
    async findUserById(id) {
      return user(await db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first());
    },
    async insertUser(u) {
      await db
        .prepare('INSERT INTO users (id, username, email, password_hash, email_verified, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(u.id, u.username, u.email, u.password_hash, u.email_verified, u.created_at)
        .run();
    },
    async setPassword(userId, hash) {
      await db.prepare('UPDATE users SET password_hash = ?1 WHERE id = ?2').bind(hash, userId).run();
    },
    async setVerified(userId) {
      await db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?1').bind(userId).run();
    },
    async deleteUser(userId) {
      // ON DELETE CASCADE takes the sessions, tokens and documents with it.
      await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
    },
    async insertSession(tokenHash, userId, now, expiresAt) {
      await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(tokenHash, userId, now, expiresAt).run();
    },
    async findSession(tokenHash) {
      const row = await db
        .prepare('SELECT u.*, s.expires_at AS session_expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?1')
        .bind(tokenHash)
        .first<Record<string, unknown>>();
      if (!row) return null;
      return { user: user(row)!, expires_at: Number(row.session_expires) };
    },
    async deleteSession(tokenHash) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
    },
    async deleteSessionsFor(userId) {
      await db.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(userId).run();
    },
    async insertToken(tokenHash, userId, kind, expiresAt) {
      await db.prepare('INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(tokenHash, userId, kind, expiresAt).run();
    },
    async findToken(tokenHash, kind) {
      const row = await db.prepare('SELECT user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = ?1 AND kind = ?2').bind(tokenHash, kind).first<Record<string, unknown>>();
      return row ? { user_id: String(row.user_id), expires_at: Number(row.expires_at), used_at: row.used_at === null ? null : Number(row.used_at) } : null;
    },
    async useToken(tokenHash, now) {
      await db.prepare('UPDATE auth_tokens SET used_at = ?1 WHERE token_hash = ?2').bind(now, tokenHash).run();
    },
    async bumpRateLimit(key, now, windowEnd) {
      const row = await db
        .prepare(
          `INSERT INTO rate_limits (key, count, window_end) VALUES (?1, 1, ?2)
           ON CONFLICT(key) DO UPDATE SET
             count = CASE WHEN window_end < ?3 THEN 1 ELSE count + 1 END,
             window_end = CASE WHEN window_end < ?3 THEN ?2 ELSE window_end END
           RETURNING count`,
        )
        .bind(key, windowEnd, now)
        .first<{ count: number }>();
      return Number(row?.count ?? 1);
    },
    async purgeExpired(userId, now) {
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE user_id = ?1 AND expires_at < ?2').bind(userId, now),
        db.prepare('DELETE FROM auth_tokens WHERE user_id = ?1 AND expires_at < ?2').bind(userId, now),
      ]);
    },
    async getDoc(table, userId) {
      const row = await db.prepare(`SELECT data, updated_at FROM ${table} WHERE user_id = ?1`).bind(userId).first<Record<string, unknown>>();
      return row ? { data: String(row.data), updated_at: Number(row.updated_at) } : null;
    },
    async putDoc(table, userId, data, now) {
      await db
        .prepare(`INSERT INTO ${table} (user_id, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET data = ?2, updated_at = ?3`)
        .bind(userId, data, now)
        .run();
    },
    async deleteDoc(table, userId) {
      await db.prepare(`DELETE FROM ${table} WHERE user_id = ?1`).bind(userId).run();
    },
  };
}
