import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { playRun, step } from '../ai/runner';
import { playFight } from '../ai/heuristic';
import { addRelic, availableNodes, buy, combatHooks, createRun, enterNode, finishFight, finishReward, openShop, removeCard, rest, reviveRun, serializeRun, smith, startFight, takeCard, takeTreasure, takeVial } from './run';

const content = loadContent();

describe('run', () => {
  it('starts with the class starter deck, its starter relic, and a valid map', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'r1' });
    expect(run.hero.deck.length).toBe(10);
    expect(run.hero.relics).toEqual(['sunbrand-libram']);
    expect(availableNodes(run).length).toBeGreaterThan(0);
    expect(availableNodes(run).every((n) => n.floor === 1 && n.type === 'fight')).toBe(true);
  });

  it('relic hooks reach the fight: Iron Bookmark blocks, Sunbrand Libram gives Holy Power', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'hooks' });
    run.hero.relics.push('iron-bookmark');
    startFight(run, content, 'fight', ['ink-slime']);
    const s = run.fight!.state;
    expect(s.hero.block).toBe(4);
    expect(s.hero.resources.holyPower).toBe(1);
    expect(s.hero.relics).toContain('iron-bookmark');
  });

  it('a fight pays out: gold, three distinct cards, and elites drop a relic', () => {
    const run = createRun(content, { classId: 'mage', seed: 'pay' });
    startFight(run, content, 'elite', ['ink-slime']);
    playFight(run.fight!.state, content);
    expect(run.fight!.state.phase).toBe('won');
    finishFight(run, content);
    expect(run.phase).toBe('reward');
    const r = run.reward!;
    expect(r.gold).toBeGreaterThanOrEqual(25);
    expect(new Set(r.cards).size).toBe(3);
    // The Ink Slime's page was just written, so as an "elite" its Secret is one of the three.
    expect(r.cards).toContain('ink-splash');
    for (const id of r.cards) expect(['mage', 'neutral', 'secret']).toContain(content.cards[id]!.class);
    expect(r.relic).toBeTruthy();
    const gold = run.hero.gold;
    takeCard(run, content, r.cards[0]!);
    expect(run.hero.deck.length).toBe(11);
    finishReward(run, content);
    expect(run.hero.gold).toBe(gold + r.gold);
    expect(run.phase).toBe('map');
  });

  it('the first three fights of a chapter come from the easy pool and never repeat', () => {
    const pools = content.encounters![1]!;
    const easy = new Set(pools.easy.map((g) => g.join('+')));
    for (let i = 0; i < 20; i++) {
      const run = createRun(content, { classId: 'tracker', seed: `pool-${i}` });
      const seen: string[] = [];
      for (let k = 0; k < 3; k++) {
        startFight(run, content, 'fight');
        seen.push(run.fight!.encounter.join('+'));
        run.fight = null;
        run.phase = 'map';
      }
      for (const s of seen) expect(easy.has(s), s).toBe(true);
      expect(new Set(seen).size).toBe(3);
    }
  });

  it('shop, camp and removal keep the books straight', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'shop' });
    run.hero.gold = 500;
    run.position = 'f1c0';
    run.phase = 'map';
    // Force a shop by opening one directly.
    openShop(run, content);
    const shop = run.shop!;
    expect(shop.cards.length).toBeGreaterThanOrEqual(4);
    expect(shop.relics.length).toBeGreaterThanOrEqual(2);
    const price = shop.cards[0]!.price;
    expect(buy(run, content, 'cards', 0)).toBe(true);
    expect(run.hero.gold).toBe(500 - price);
    expect(buy(run, content, 'cards', 0)).toBe(false); // sold
    const before = run.hero.deck.length;
    expect(removeCard(run, run.hero.deck[0]!.uid)).toBe(true);
    expect(run.hero.deck.length).toBe(before - 1);
    expect(shop.removalPrice).toBe(75);

    run.phase = 'camp';
    run.camp = { used: false };
    run.hero.hp = 40;
    expect(rest(run, content)).toBe(true);
    expect(run.hero.hp).toBe(40 + Math.round(80 * 0.3));
    expect(smith(run, content, [run.hero.deck[0]!.uid])).toBe(false); // camp already used
  });

  it('serialises mid-fight and resumes with the same RNG and hand', () => {
    const run = createRun(content, { classId: 'mage', seed: 'save' });
    startFight(run, content, 'fight', ['mossback-beetle']);
    const json = JSON.stringify(serializeRun(run));
    const back = reviveRun(content, JSON.parse(json));
    expect(back.fight!.state.piles.hand.map((c) => c.cardId)).toEqual(run.fight!.state.piles.hand.map((c) => c.cardId));
    expect(back.fight!.state.rng.shuffle.next()).toBe(run.fight!.state.rng.shuffle.next());
    expect(back.rng.rewards.next()).toBe(run.rng.rewards.next());
    expect(combatHooks(back, content).resources.charge).toBe(1);
  });

  it('vials are capped by slots', () => {
    const run = createRun(content, { classId: 'tracker', seed: 'vials' });
    run.hero.vials = ['ember-vial', 'ember-vial', 'ember-vial'];
    run.reward = { kind: 'fight', gold: 0, goldTaken: false, cards: [], cardTaken: true, relic: null, relicTaken: true, vial: 'frost-vial', vialTaken: false };
    run.phase = 'reward';
    expect(takeVial(run)).toBe(false);
  });

  it('whole runs complete, deterministically, with a believable floor distribution', () => {
    const results = Array.from({ length: 30 }, (_, i) => playRun(content, { classId: (['paladin', 'tracker', 'mage'] as const)[i % 3]!, seed: `run-${i}` }));
    for (const r of results) expect(r.floor).toBeGreaterThan(0);
    const again = playRun(content, { classId: 'paladin', seed: 'run-0' });
    expect(again).toEqual(results[0]);
    const avg = results.reduce((a, r) => a + r.floor, 0) / results.length;
    expect(avg).toBeGreaterThan(3);
  });

  it('a relic already held is never stocked, never sold, and never charged for', () => {
    // Stock is rolled when the shop opens and excludes what the hero holds.
    for (let i = 0; i < 50; i++) {
      const run = createRun(content, { classId: 'paladin', seed: `stock-${i}` });
      addRelic(run, content, 'phylactery');
      openShop(run, content);
      expect(run.shop!.relics.map((r) => r.id)).not.toContain('phylactery');
      for (const item of run.shop!.relics) expect(run.hero.relics).not.toContain(item.id);
    }
    // And if stock ever goes stale — a resumed run, a relic taken since — buying is refused
    // outright rather than taking the gold and granting nothing.
    const run = createRun(content, { classId: 'paladin', seed: 'stale' });
    openShop(run, content);
    const target = run.shop!.relics[0]!;
    addRelic(run, content, target.id);
    const gold = run.hero.gold = 999;
    expect(buy(run, content, 'relics', 0)).toBe(false);
    expect(run.hero.gold).toBe(gold);
    expect(target.sold).toBe(false);
    expect(run.hero.relics.filter((id) => id === target.id)).toHaveLength(1);
  });

  it('a treasure already held leaves the choice open rather than consuming it', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'treasure-dupe' });
    run.phase = 'treasure';
    run.treasure = { relics: ['phylactery'], taken: false };
    addRelic(run, content, 'phylactery');
    takeTreasure(run, content, 'phylactery');
    expect(run.treasure.taken).toBe(false);
    expect(run.hero.relics.filter((id) => id === 'phylactery')).toHaveLength(1);
  });

  it('spends one revive source per killing blow, keeping the rest', () => {
    // Two feathers are two chances, and surviving once leaves the second one in the belt.
    const two = createRun(content, { classId: 'paladin', seed: 'feathers' });
    two.hero.vials = ['phoenix-feather', 'phoenix-feather'];
    startFight(two, content, 'fight');
    const a = two.fight!.state;
    expect(a.hero.revives).toBe(2);
    a.hero.revives = 1;
    a.hero.revivesUsed = 1;
    a.phase = 'won';
    for (const e of a.enemies) e.alive = false;
    finishFight(two, content);
    expect(two.hero.vials).toEqual(['phoenix-feather']);

    // The Phylactery is free, so it goes before the feather the player paid for.
    const both = createRun(content, { classId: 'paladin', seed: 'both' });
    addRelic(both, content, 'phylactery');
    both.hero.vials = ['phoenix-feather'];
    startFight(both, content, 'fight');
    const b = both.fight!.state;
    expect(b.hero.revives).toBe(2);
    b.hero.revives = 1;
    b.hero.revivesUsed = 1;
    b.phase = 'won';
    for (const e of b.enemies) e.alive = false;
    finishFight(both, content);
    expect(both.hero.relicsUsed).toContain('phylactery');
    expect(both.hero.vials).toEqual(['phoenix-feather']);

    // Nothing spent, nothing lost.
    const idle = createRun(content, { classId: 'paladin', seed: 'idle' });
    idle.hero.vials = ['phoenix-feather'];
    startFight(idle, content, 'fight');
    const c = idle.fight!.state;
    c.phase = 'won';
    for (const e of c.enemies) e.alive = false;
    finishFight(idle, content);
    expect(idle.hero.vials).toEqual(['phoenix-feather']);
    expect(idle.hero.relicsUsed).toEqual([]);
  });

  it('a fight saved before revives were counted keeps its revive on resume', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'old-save' });
    run.hero.vials = ['phoenix-feather'];
    startFight(run, content, 'fight');
    // An old save: the flag, no counters.
    const saved = JSON.parse(JSON.stringify(serializeRun(run))) as { fight: { state: { hero: Record<string, unknown> } } };
    saved.fight.state.hero.flags = { reviveOnce: true };
    delete saved.fight.state.hero.revives;
    delete saved.fight.state.hero.revivesUsed;
    const back = reviveRun(content, saved);
    expect(back.fight!.state.hero.revives).toBe(1);
    expect(back.fight!.state.hero.revivesUsed).toBe(0);
  });

  it('every phase step is safe to call repeatedly', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'steps' });
    for (let i = 0; i < 60 && run.phase !== 'won' && run.phase !== 'lost'; i++) step(run, content);
    expect(['won', 'lost', 'map', 'fight', 'reward', 'shop', 'camp', 'event', 'treasure', 'bossReward']).toContain(run.phase);
    enterNode(run, content, 'nope');
  });
});
