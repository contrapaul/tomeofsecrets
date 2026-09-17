import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { playRun, step } from '../ai/runner';
import { playFight } from '../ai/heuristic';
import { availableNodes, buy, combatHooks, createRun, enterNode, finishFight, finishReward, openShop, removeCard, rest, reviveRun, serializeRun, smith, startFight, takeCard, takeVial } from './run';

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
    for (const id of r.cards) expect(['mage', 'neutral']).toContain(content.cards[id]!.class);
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

  it('every phase step is safe to call repeatedly', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'steps' });
    for (let i = 0; i < 60 && run.phase !== 'won' && run.phase !== 'lost'; i++) step(run, content);
    expect(['won', 'lost', 'map', 'fight', 'reward', 'shop', 'camp', 'event', 'treasure', 'bossReward']).toContain(run.phase);
    enterNode(run, content, 'nope');
  });
});
