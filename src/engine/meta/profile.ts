import { Profile, type ClassId, type CompanionId, type Page } from '../../content/schema';
import type { CombatState, Content } from '../rules';
import type { RunState } from '../run/run';

/**
 * The player's Tome: what survives between runs (docs/design.md §9). Pure:
 * the app stores it, the run reads its unlocks at creation, and every fight
 * and run end writes back through here.
 */

export type { Profile };

export function defaultProfile(): Profile {
  return {
    version: 1,
    lore: 0,
    loreEarned: 0,
    bestiary: {},
    cardsSeen: [],
    relicsSeen: [],
    pages: [],
    seals: {},
    stats: { runs: 0, wins: {}, bestFloor: {}, kills: 0, cardsPlayed: {}, fastestWinMs: null },
    history: [],
  };
}

/** A stored profile, or a fresh one if it does not parse. */
export function parseProfile(data: unknown): Profile {
  const r = Profile.safeParse(data);
  return r.success ? r.data : defaultProfile();
}

// ---------------------------------------------------------------- unlocks

export interface Unlocks {
  /** Cards that may be offered as rewards or sold. */
  cards: Set<string>;
  relics: Set<string>;
  boons: string[];
  origins: string[];
  companions: CompanionId[];
}

/** Everything no page claims is open from the start; a page opens what it lists once bought. */
export function unlocks(profile: Profile, content: Content): Unlocks {
  const pages = Object.values(content.pages ?? {});
  const claimed = new Map<string, Set<string>>();
  for (const p of pages) for (const id of p.unlocks) (claimed.get(p.kind) ?? claimed.set(p.kind, new Set()).get(p.kind)!).add(id);
  const owned = new Set<string>();
  for (const p of pages) if (profile.pages.includes(p.id)) for (const id of p.unlocks) owned.add(id);
  const open = (kind: Page['kind'], id: string) => !claimed.get(kind)?.has(id) || owned.has(id);
  return {
    cards: new Set(Object.keys(content.cards).filter((id) => open('cards', id))),
    relics: new Set(Object.keys(content.relics ?? {}).filter((id) => open('relics', id))),
    boons: Object.keys(content.boons ?? {}).filter((id) => open('boon', id)),
    origins: Object.values(content.origins ?? {}).filter((o) => o.default || open('origin', o.id)).map((o) => o.id),
    companions: (['wolf', 'bear', 'hawk', 'serpent', 'boar'] as CompanionId[]).filter((id) => open('companion', id)),
  };
}

export type PageStatus = 'owned' | 'available' | 'locked' | 'unaffordable';

export function pageStatus(profile: Profile, page: Page): PageStatus {
  if (profile.pages.includes(page.id)) return 'owned';
  if (page.requires && !profile.pages.includes(page.requires)) return 'locked';
  return profile.lore >= page.cost ? 'available' : 'unaffordable';
}

export function buyPage(profile: Profile, content: Content, pageId: string): boolean {
  const page = content.pages?.[pageId];
  if (!page || pageStatus(profile, page) !== 'available') return false;
  profile.lore -= page.cost;
  profile.pages.push(pageId);
  return true;
}

/** Seals a class may start at: 0 up to its highest win + 1. */
export function maxSeal(profile: Profile, classId: ClassId): number {
  return Math.min(10, profile.seals[classId] ?? 0);
}

// ---------------------------------------------------------------- writing the Tome

function entry(profile: Profile, enemyId: string) {
  return (profile.bestiary[enemyId] ??= { seen: 0, kills: 0, moves: [] });
}

/**
 * After a fight, won or lost: every enemy in it was seen, its moves are
 * remembered, and kills write pages. Returns the enemy ids whose page was
 * written for the first time.
 */
export function recordFight(profile: Profile, state: CombatState): string[] {
  const fresh: string[] = [];
  const counted = new Set<string>();
  for (const e of state.enemies) {
    const b = entry(profile, e.enemyId);
    if (!counted.has(e.enemyId)) {
      b.seen++;
      counted.add(e.enemyId);
    }
    for (const m of e.history) if (!b.moves.includes(m)) b.moves.push(m);
    if (!e.alive) {
      if (b.kills === 0 && !fresh.includes(e.enemyId)) fresh.push(e.enemyId);
      b.kills++;
      profile.stats.kills++;
    }
  }
  for (const c of [...state.piles.draw, ...state.piles.hand, ...state.piles.discard, ...state.piles.exhaust]) if (!profile.cardsSeen.includes(c.cardId)) profile.cardsSeen.push(c.cardId);
  for (const r of state.hero.relics) if (!profile.relicsSeen.includes(r)) profile.relicsSeen.push(r);
  return fresh;
}

export interface LoreLine {
  label: string;
  amount: number;
}

export interface RunLedger {
  lines: LoreLine[];
  total: number;
  /** Bestiary pages this run wrote. */
  newPages: string[];
  /** A Seal the win unlocked, if any. */
  sealUnlocked: number | null;
}

/** docs/design.md §9.1. */
export function loreFor(run: RunState, newPages: number, won: boolean): LoreLine[] {
  const lines: LoreLine[] = [];
  const add = (label: string, amount: number) => {
    if (amount > 0) lines.push({ label, amount });
  };
  add(`${run.stats.floorsClimbed} floors climbed`, run.stats.floorsClimbed * 2);
  add(`${run.stats.elites} elites slain`, run.stats.elites * 8);
  add(`${run.stats.bosses} bosses slain`, run.stats.bosses * 20);
  add(`${newPages} new Bestiary page${newPages === 1 ? '' : 's'}`, newPages * 5);
  if (won) add('Victory', 100);
  if (won && run.seal > 0) add(`Seal ${run.seal}`, run.seal * 10);
  return lines;
}

/**
 * The run is over. Lore is banked, stats and history updated, and a win at
 * Seal N opens Seal N+1 for that class. Idempotent per run: the ledger is
 * stored on the run and a second call returns it.
 */
export function recordRun(profile: Profile, run: RunState, now: string): RunLedger {
  if (run.ledger) return run.ledger;
  const won = run.phase === 'won';
  const abandoned = !!run.abandoned;
  const newPages = run.pagesWritten ?? [];
  const lines = loreFor(run, newPages.length, won);
  const total = lines.reduce((n, l) => n + l.amount, 0);
  profile.lore += total;
  profile.loreEarned += total;
  profile.stats.runs++;
  const cls = run.hero.classId;
  profile.stats.bestFloor[cls] = Math.max(profile.stats.bestFloor[cls] ?? 0, run.stats.floorsClimbed);
  for (const [id, n] of Object.entries(run.stats.cardsPlayed)) profile.stats.cardsPlayed[id] = (profile.stats.cardsPlayed[id] ?? 0) + n;
  let sealUnlocked: number | null = null;
  if (won) {
    profile.stats.wins[cls] = (profile.stats.wins[cls] ?? 0) + 1;
    const ms = Date.parse(now) - Date.parse(run.startedAt);
    if (Number.isFinite(ms) && ms > 0 && (profile.stats.fastestWinMs === null || ms < profile.stats.fastestWinMs)) profile.stats.fastestWinMs = ms;
    if (run.seal >= (profile.seals[cls] ?? 0) && run.seal < 10) {
      profile.seals[cls] = run.seal + 1;
      sealUnlocked = run.seal + 1;
    }
  }
  profile.history.unshift({
    seed: run.seed,
    classId: cls,
    result: won ? 'won' : abandoned ? 'abandoned' : 'lost',
    floor: run.stats.floorsClimbed,
    chapter: run.chapter,
    seal: run.seal,
    lore: total,
    date: now,
    ...(run.stats.deathBy ? { killedBy: run.stats.deathBy.enemy } : {}),
    ...(run.origin ? { origin: run.origin } : {}),
    ...(run.boon ? { boon: run.boon } : {}),
  });
  profile.history = profile.history.slice(0, 20);
  run.ledger = { lines, total, newPages, sealUnlocked };
  return run.ledger;
}

// ---------------------------------------------------------------- merging two Tomes

/**
 * Two copies of a Tome become one that has everything either had: sets are
 * unioned, counters and best floors take the larger, Lore takes the larger,
 * Seals the larger per class, history the union by seed and date (newest
 * first, capped at 20). Idempotent and order-independent, which is what makes
 * carrying an anonymous Tome into an account, or playing offline on two
 * devices, safe. Neither input is changed.
 */
export function mergeProfiles(a: Profile, b: Profile): Profile {
  // Sorted, so the same two Tomes merge to the same bytes whichever way round.
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])].sort();
  const maxRec = (x: Record<string, number>, y: Record<string, number>) => {
    const out: Record<string, number> = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] ?? 0, v);
    return out;
  };
  const sumRec = (x: Record<string, number>, y: Record<string, number>) => {
    // Cards played is a running total on both sides; the larger side is the
    // fuller record, so take max rather than double-count.
    return maxRec(x, y);
  };
  const bestiary: Profile['bestiary'] = {};
  for (const id of union(Object.keys(a.bestiary), Object.keys(b.bestiary))) {
    const x = a.bestiary[id];
    const y = b.bestiary[id];
    bestiary[id] = {
      seen: Math.max(x?.seen ?? 0, y?.seen ?? 0),
      kills: Math.max(x?.kills ?? 0, y?.kills ?? 0),
      moves: union(x?.moves ?? [], y?.moves ?? []),
    };
  }
  const seenRun = new Set<string>();
  const history = [...a.history, ...b.history]
    .filter((r) => {
      const key = `${r.seed}|${r.date}`;
      if (seenRun.has(key)) return false;
      seenRun.add(key);
      return true;
    })
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 20);
  return {
    version: 1,
    lore: Math.max(a.lore, b.lore),
    loreEarned: Math.max(a.loreEarned, b.loreEarned),
    bestiary,
    cardsSeen: union(a.cardsSeen, b.cardsSeen),
    relicsSeen: union(a.relicsSeen, b.relicsSeen),
    pages: union(a.pages, b.pages),
    seals: maxRec(a.seals, b.seals),
    stats: {
      runs: Math.max(a.stats.runs, b.stats.runs),
      wins: maxRec(a.stats.wins, b.stats.wins),
      bestFloor: maxRec(a.stats.bestFloor, b.stats.bestFloor),
      kills: Math.max(a.stats.kills, b.stats.kills),
      cardsPlayed: sumRec(a.stats.cardsPlayed, b.stats.cardsPlayed),
      fastestWinMs: a.stats.fastestWinMs === null ? b.stats.fastestWinMs : b.stats.fastestWinMs === null ? a.stats.fastestWinMs : Math.min(a.stats.fastestWinMs, b.stats.fastestWinMs),
    },
    history,
  };
}

/** True when a Tome has anything worth carrying into an account. */
export function hasProgress(p: Profile): boolean {
  return p.lore > 0 || p.loreEarned > 0 || p.pages.length > 0 || p.stats.runs > 0 || Object.keys(p.bestiary).length > 0;
}

// ---------------------------------------------------------------- save codes

function checksum(s: string): string {
  // FNV-1a, 32-bit, as six base-36 characters.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(-6);
}

const PREFIX = 'TOME1';

/** A profile as a pasteable code: prefix, checksum, base64url JSON. */
export function encodeProfile(profile: Profile): string {
  const json = JSON.stringify(profile);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${PREFIX}-${checksum(json)}-${b64}`;
}

export type Decoded = { ok: true; profile: Profile } | { ok: false; error: string };

export function decodeProfile(code: string): Decoded {
  const parts = code.trim().split('-');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: 'That is not a Tome save code.' };
  const [, sum, b64] = parts as [string, string, string];
  let json: string;
  try {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } catch {
    return { ok: false, error: 'The code is damaged: it could not be read.' };
  }
  if (checksum(json) !== sum) return { ok: false, error: 'The code is damaged: its checksum does not match. Copy it again, whole.' };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'The code is damaged: it is not a profile.' };
  }
  const r = Profile.safeParse(data);
  if (!r.success) return { ok: false, error: 'The code is from a version this game cannot read.' };
  return { ok: true, profile: r.data };
}
