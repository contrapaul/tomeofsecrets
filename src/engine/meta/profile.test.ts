import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { playFight } from '../ai/heuristic';
import { createRun, finishFight, startFight } from '../run/run';
import { buyPage, decodeProfile, defaultProfile, encodeProfile, hasProgress, loreFor, mergeProfiles, pageStatus, parseProfile, recordFight, recordRun, unlocks } from './profile';

const content = loadContent();

describe('profile', () => {
  it('opens everything no page claims, and what bought pages list', () => {
    const p = defaultProfile();
    const u = unlocks(p, content);
    expect(u.cards.has('judgment')).toBe(true); // a common: no page claims it
    expect(u.cards.has('blade-of-justice')).toBe(false); // on the Verdicts page
    expect(u.relics.has('iron-bookmark')).toBe(true);
    expect(u.relics.has('phylactery')).toBe(false);
    expect(u.boons).toEqual(['bright-start', 'full-purse', 'trinket']);
    expect(u.origins).toEqual(['oath-of-the-shield', 'beastmaster', 'arcanist']);
    expect(u.companions).toEqual(['wolf']);
    p.lore = 60;
    expect(pageStatus(p, content.pages['paladin-bulwark']!)).toBe('locked'); // requires Verdicts
    expect(buyPage(p, content, 'paladin-verdicts')).toBe(true);
    expect(p.lore).toBe(0);
    expect(buyPage(p, content, 'paladin-verdicts')).toBe(false); // owned
    expect(unlocks(p, content).cards.has('blade-of-justice')).toBe(true);
    expect(pageStatus(p, content.pages['paladin-bulwark']!)).toBe('unaffordable');
  });

  it('a kill writes the page; a lost run still earns Lore and history', () => {
    const p = defaultProfile();
    const run = createRun(content, { classId: 'paladin', seed: 'lore1', known: [] });
    startFight(run, content, 'fight', ['ink-slime']);
    playFight(run.fight!.state, content);
    const fresh = recordFight(p, run.fight!.state);
    expect(fresh).toContain('ink-slime');
    expect(p.bestiary['ink-slime']!.kills).toBeGreaterThan(0);
    expect(p.bestiary['ink-slime']!.moves.length).toBeGreaterThan(0);
    finishFight(run, content);
    expect(run.pagesWritten).toContain('ink-slime');
    run.stats.floorsClimbed = 4;
    run.phase = 'lost';
    const ledger = recordRun(p, run, '2026-09-17T12:00:00Z');
    expect(ledger.total).toBe(4 * 2 + 5 * run.pagesWritten!.length);
    expect(p.lore).toBe(ledger.total);
    expect(p.history[0]!.result).toBe('lost');
    expect(recordRun(p, run, '2026-09-17T12:01:00Z')).toBe(ledger); // idempotent
    expect(p.stats.runs).toBe(1);
  });

  it('a win unlocks the next Seal for that class and pays the victory bonus', () => {
    const p = defaultProfile();
    const run = createRun(content, { classId: 'mage', seed: 'win1', seal: 0 });
    run.stats.floorsClimbed = 10;
    run.stats.bosses = 1;
    run.phase = 'won';
    const ledger = recordRun(p, run, '2026-09-17T12:00:00Z');
    expect(ledger.sealUnlocked).toBe(1);
    expect(p.seals['mage']).toBe(1);
    expect(loreFor(run, 0, true).find((l) => l.label === 'Victory')?.amount).toBe(100);
    expect(ledger.total).toBe(20 + 20 + 100);
  });

  it('save codes round-trip and reject damage', () => {
    const p = defaultProfile();
    p.lore = 123;
    p.pages.push('relics-odds');
    const code = encodeProfile(p);
    const back = decodeProfile(code);
    expect(back.ok && back.profile).toEqual(p);
    const bad = decodeProfile(code.slice(0, -4) + 'zzzz');
    expect(bad.ok).toBe(false);
    expect(decodeProfile('hello').ok).toBe(false);
    expect(parseProfile({ nonsense: true }).lore).toBe(0);
  });

  it('origins swap starters and relics; seals toughen enemies; boons apply', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'orig', origin: 'oath-of-vengeance', seal: 4, boon: 'bright-start' });
    expect(run.hero.relics).toEqual(['ashen-libram']);
    expect(run.hero.deck.filter((c) => c.cardId === 'hammer-blow').length).toBe(2);
    expect(run.hero.deck.some((c) => c.cardId === 'judgment')).toBe(true);
    expect(run.hero.maxHp).toBe(80 - 5 + 10);
    startFight(run, content, 'boss', ['bookwyrm']);
    const boss = run.fight!.state.enemies[0]!;
    const [lo, hi] = content.enemies['bookwyrm']!.hp;
    expect(boss.maxHp).toBeGreaterThanOrEqual(Math.round(lo * 1.15));
    expect(boss.maxHp).toBeLessThanOrEqual(Math.round(hi * 1.15));
    const survivalist = createRun(content, { classId: 'tracker', seed: 'orig2', origin: 'survivalist' });
    expect(survivalist.hero.companion).toBe('serpent');
    expect(survivalist.hero.relics).toEqual(['bone-whistle-worn']);
  });

  it('the reward pool honours the unlock set', () => {
    const p = defaultProfile();
    const u = unlocks(p, content);
    const run = createRun(content, { classId: 'paladin', seed: 'pool', pool: { cards: [...u.cards], relics: [...u.relics] } });
    for (let i = 0; i < 12; i++) {
      startFight(run, content, 'fight', ['page-wisp']);
      playFight(run.fight!.state, content);
      if (run.fight!.state.phase !== 'won') break;
      finishFight(run, content);
      for (const id of run.reward!.cards) expect(u.cards.has(id) || content.cards[id]!.class === 'secret').toBe(true);
      run.reward = null;
      run.phase = 'map';
    }
  });
});

describe('mergeProfiles', () => {
  const a = defaultProfile();
  a.lore = 40;
  a.loreEarned = 100;
  a.pages.push('paladin-verdicts');
  a.bestiary['ink-slime'] = { seen: 3, kills: 2, moves: ['divide'] };
  a.cardsSeen.push('judgment');
  a.seals['paladin'] = 2;
  a.stats.runs = 3;
  a.stats.bestFloor['paladin'] = 7;
  a.stats.fastestWinMs = 900000;
  a.history.push({ seed: 's1', classId: 'paladin', result: 'lost', floor: 4, chapter: 1, seal: 0, lore: 10, date: '2026-09-01T00:00:00Z' });
  const b = defaultProfile();
  b.lore = 25;
  b.loreEarned = 60;
  b.pages.push('relics-odds');
  b.bestiary['ink-slime'] = { seen: 1, kills: 0, moves: ['splash'] };
  b.bestiary['page-wisp'] = { seen: 1, kills: 1, moves: [] };
  b.cardsSeen.push('judgment', 'bulwark');
  b.seals['mage'] = 1;
  b.stats.runs = 5;
  b.stats.bestFloor['paladin'] = 3;
  b.stats.fastestWinMs = null;
  b.history.push({ seed: 's1', classId: 'paladin', result: 'lost', floor: 4, chapter: 1, seal: 0, lore: 10, date: '2026-09-01T00:00:00Z' });
  b.history.push({ seed: 's2', classId: 'mage', result: 'won', floor: 11, chapter: 1, seal: 0, lore: 150, date: '2026-09-02T00:00:00Z' });

  it('keeps everything either side had', () => {
    const m = mergeProfiles(a, b);
    expect(m.lore).toBe(40);
    expect(m.loreEarned).toBe(100);
    expect(m.pages.sort()).toEqual(['paladin-verdicts', 'relics-odds']);
    expect(m.bestiary['ink-slime']).toEqual({ seen: 3, kills: 2, moves: ['divide', 'splash'] });
    expect(m.bestiary['page-wisp']!.kills).toBe(1);
    expect(m.cardsSeen.sort()).toEqual(['bulwark', 'judgment']);
    expect(m.seals).toEqual({ paladin: 2, mage: 1 });
    expect(m.stats.runs).toBe(5);
    expect(m.stats.bestFloor['paladin']).toBe(7);
    expect(m.stats.fastestWinMs).toBe(900000);
    expect(m.history.map((r) => r.seed)).toEqual(['s2', 's1']);
  });

  it('is symmetric and idempotent', () => {
    const ab = mergeProfiles(a, b);
    const ba = mergeProfiles(b, a);
    expect({ ...ab, cardsSeen: ab.cardsSeen.sort(), pages: ab.pages.sort() }).toEqual({ ...ba, cardsSeen: ba.cardsSeen.sort(), pages: ba.pages.sort() });
    expect(mergeProfiles(ab, ab)).toEqual(ab);
    expect(mergeProfiles(ab, defaultProfile())).toEqual(ab);
  });

  it('survives the schema and knows an empty Tome from one with progress', () => {
    expect(parseProfile(mergeProfiles(a, b))).toEqual(mergeProfiles(a, b));
    expect(hasProgress(defaultProfile())).toBe(false);
    expect(hasProgress(a)).toBe(true);
  });
});
