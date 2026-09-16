import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { playTurn } from '../ai/heuristic';
import { createCombat, drainEvents, type CombatState } from './index';

const content = loadContent({ fixtures: true });

interface Snap {
  heroHp: number;
  heroBlock: number;
  energy: number;
  hand: number[];
  statuses: string;
  enemies: { id: string; hp: number; block: number; alive: boolean; statuses: string }[];
}

function snap(s: CombatState): Snap {
  return {
    heroHp: s.hero.hp,
    heroBlock: s.hero.block,
    energy: s.hero.energy,
    hand: s.piles.hand.map((c) => c.uid),
    statuses: JSON.stringify(s.hero.statuses),
    enemies: s.enemies.map((e) => ({ id: e.id, hp: e.hp, block: e.block, alive: e.alive, statuses: JSON.stringify(e.statuses) })),
  };
}

/**
 * Every mutation must emit. Play whole fights with the heuristic and, after
 * each turn, check that every visible difference has an event that explains it.
 */
describe('every mutation emits', () => {
  const decks = [
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash', 'cleave', 'twin-strike', 'inflame'],
    ['test-generator', 'test-generator', 'test-verdict', 'test-verdict', 'defend', 'defend', 'test-power', 'missiles', 'second-look', 'test-trap', 'test-sic', 'grit'],
    ['test-frost', 'test-frost', 'test-frost', 'trip', 'trip', 'defend', 'defend', 'quick-jab', 'whetstone', 'bandages', 'test-exhaust', 'finishing-blow'],
  ];
  const encounters = [['dummy-brute'], ['dummy-cur', 'dummy-cur'], ['dummy-wisp', 'dummy-wisp', 'dummy-wisp'], ['dummy-slime'], ['dummy-boss']];

  for (const [di, deck] of decks.entries()) {
    for (const [ei, enemies] of encounters.entries()) {
      it(`deck ${di} vs ${enemies.join('+')}`, () => {
        const s = createCombat(content, { classId: 'tracker', maxHp: 80, deck: deck.map((cardId) => ({ cardId })), companion: 'wolf' }, { enemies }, `inv-${di}-${ei}`);
        drainEvents(s);
        let turns = 0;
        while (s.phase === 'player' && turns++ < 30) {
          const before = snap(s);
          playTurn(s, content);
          const events = drainEvents(s);
          const after = snap(s);
          const types = new Set<string>(events.map((e) => e.t));
          const explain = (cond: boolean, needed: string[], what: string) => {
            if (cond) expect(needed.some((t) => types.has(t)), `${what} changed without ${needed.join('/')} (turn ${turns})`).toBe(true);
          };
          explain(before.heroHp !== after.heroHp, ['damage', 'heal'], 'hero hp');
          explain(before.heroBlock !== after.heroBlock, ['block'], 'hero block');
          explain(before.energy !== after.energy, ['energy'], 'energy');
          explain(before.statuses !== after.statuses, ['status'], 'hero statuses');
          explain(JSON.stringify(before.hand) !== JSON.stringify(after.hand), ['draw', 'cardMoved', 'play'], 'hand');
          for (const e of after.enemies) {
            const b = before.enemies.find((x) => x.id === e.id);
            if (!b) {
              explain(true, ['summon'], `enemy ${e.id} appeared`);
              continue;
            }
            explain(b.hp !== e.hp, ['damage', 'heal'], `enemy ${e.id} hp`);
            explain(b.block !== e.block, ['block'], `enemy ${e.id} block`);
            explain(b.alive !== e.alive, ['die'], `enemy ${e.id} alive`);
            explain(b.statuses !== e.statuses, ['status'], `enemy ${e.id} statuses`);
          }
        }
        expect(s.phase === 'won' || s.phase === 'lost' || turns >= 30).toBe(true);
      });
    }
  }
});
