import type { Content } from '../rules';
import {
  availableNodes, buy, createRun, enterNode, finishFight, finishReward, leaveCamp, leaveEvent, leaveShop, leaveTreasure, removeCard, rest,
  smith, takeBossRelic, takeCard, takeRewardRelic, takeTreasure, takeVial, upgradeable, type RunSetup, type RunState,
} from '../run/run';
import { advance, choose, pick } from '../run/events';
import { playFight } from './heuristic';

/**
 * Plays a run start to finish with plain rules: walk toward camps when hurt,
 * take the first Rare or the cheapest Attack, rest below 60%, upgrade
 * otherwise. It is here to measure the content, not to be good.
 */
export interface RunResult {
  won: boolean;
  floor: number;
  fights: number;
  hpLeft: number;
  deathBy?: string;
  deckSize: number;
}

export function playRun(content: Content, setup: RunSetup, maxSteps = 200): RunResult {
  const run = createRun(content, setup);
  let steps = 0;
  while (run.phase !== 'won' && run.phase !== 'lost' && steps++ < maxSteps) step(run, content);
  return {
    won: run.phase === 'won',
    floor: run.stats.floorsClimbed,
    fights: run.stats.fights,
    hpLeft: run.hero.hp,
    deathBy: run.stats.deathBy?.enemy,
    deckSize: run.hero.deck.length,
  };
}

export function step(run: RunState, content: Content): void {
  switch (run.phase) {
    case 'map': {
      const options = availableNodes(run);
      const hurt = run.hero.hp < run.hero.maxHp * 0.5;
      const prefer = hurt ? ['camp', 'event', 'merchant', 'treasure', 'fight', 'unknown', 'elite', 'boss'] : ['treasure', 'elite', 'fight', 'camp', 'merchant', 'event', 'unknown', 'boss'];
      const pick = [...options].sort((a, b) => prefer.indexOf(a.type) - prefer.indexOf(b.type))[0]!;
      enterNode(run, content, pick.id);
      return;
    }
    case 'fight': {
      playFight(run.fight!.state, content);
      if (run.fight!.state.phase === 'player') run.phase = 'lost'; // stalemate guard
      else finishFight(run, content);
      return;
    }
    case 'reward': {
      const r = run.reward!;
      if (!r.cardTaken && run.hero.deck.length < 28) {
        const cards = r.cards.map((id) => content.cards[id]!);
        const choice = cards.find((c) => c.rarity === 'rare') ?? cards.find((c) => c.type === 'attack') ?? cards[0];
        if (choice) takeCard(run, content, choice.id);
      }
      if (r.relic) takeRewardRelic(run, content);
      if (r.vial) takeVial(run);
      finishReward(run, content);
      return;
    }
    case 'bossReward':
      takeBossRelic(run, content, run.bossRelics![0]!);
      return;
    case 'shop': {
      const shop = run.shop!;
      shop.relics.forEach((_, i) => buy(run, content, 'relics', i));
      const strike = run.hero.deck.find((c) => content.cards[c.cardId]?.rarity === 'starter' && content.cards[c.cardId]?.type === 'attack');
      if (strike) removeCard(run, strike.uid);
      shop.vials.forEach((_, i) => buy(run, content, 'vials', i));
      leaveShop(run);
      return;
    }
    case 'camp': {
      if (run.hero.hp < run.hero.maxHp * 0.6) rest(run, content);
      else {
        const up = upgradeable(run).sort((a, b) => (content.cards[a.cardId]?.rarity === 'starter' ? 1 : 0) - (content.cards[b.cardId]?.rarity === 'starter' ? 1 : 0));
        if (up.length) smith(run, content, [up[0]!.uid]);
        else rest(run, content);
      }
      leaveCamp(run);
      return;
    }
    case 'treasure':
      if (run.treasure!.relics[0]) takeTreasure(run, content, run.treasure!.relics[0]);
      leaveTreasure(run);
      return;
    case 'event': {
      const st = run.event?.state;
      if (!st) return leaveEvent(run);
      if (st.waiting === 'done') return leaveEvent(run);
      if (st.waiting === 'choice') {
        // Take the first option, unless it obviously costs HP we cannot spare.
        const safe = st.choices.findIndex((c) => !/damage|HP/i.test(c.label) || run.hero.hp > run.hero.maxHp * 0.5);
        choose(run, content, safe >= 0 ? safe : st.choices.length - 1);
        return;
      }
      if (st.waiting === 'pick') {
        const p = st.pick!;
        const cands = p.kind === 'upgrade' ? run.hero.deck.filter((c) => !c.upgraded) : run.hero.deck;
        const starters = cands.filter((c) => content.cards[c.cardId]?.rarity === 'starter');
        pick(run, content, (starters.length ? starters : cands).slice(0, p.count).map((c) => c.uid));
        return;
      }
      if (st.waiting === 'fight') return; // the fight phase handles it
      advance(run, content);
      return;
    }
    default:
      return;
  }
}
