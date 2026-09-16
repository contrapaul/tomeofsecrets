import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import type { CombatEvent } from '../events';
import {
  applyStatus, chooseIntent, createCombat, drainEvents, endTurn, getStatus, legalPlays, playCard, respondPrompt,
  type CombatState, type HeroSetup,
} from './index';

const content = loadContent({ fixtures: true });

function hero(deck: string[], extra: Partial<HeroSetup> = {}): HeroSetup {
  return { classId: 'paladin', maxHp: 80, deck: deck.map((cardId) => ({ cardId })), ...extra };
}

function fight(deck: string[], enemies: string[], seed = 'test', extra: Partial<HeroSetup> = {}): CombatState {
  return createCombat(content, hero(deck, extra), { enemies }, seed);
}

/** Play every copy of a card id in hand at the first enemy; returns how many were played. */
function playAll(state: CombatState, cardId: string, targetId = state.enemies[0]!.id): number {
  let n = 0;
  for (const inst of [...state.piles.hand]) {
    if (inst.cardId !== cardId) continue;
    const card = content.cards[cardId]!;
    const r = playCard(state, content, inst.uid, card.target === 'enemy' ? targetId : undefined);
    if (r.ok) n++;
  }
  return n;
}

function handIds(state: CombatState): string[] {
  return state.piles.hand.map((c) => c.cardId);
}

function types(events: CombatEvent[]): string[] {
  return events.map((e) => e.t);
}

describe('setup and the hero turn', () => {
  it('draws five, has three energy, and every enemy shows an intent', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute', 'dummy-cur']);
    expect(s.turn).toBe(1);
    expect(s.hero.energy).toBe(3);
    expect(s.piles.hand.length).toBe(5);
    expect(s.piles.draw.length).toBe(5);
    for (const e of s.enemies) expect(e.intent).not.toBeNull();
    expect(types(s.events)).toContain('fightStart');
    expect(types(s.events)).toContain('draw');
  });

  it('pays energy and refuses when short', () => {
    const s = fight(Array(10).fill('bash'), ['dummy-brute']);
    const e = s.enemies[0]!.id;
    expect(playCard(s, content, s.piles.hand[0]!.uid, e).ok).toBe(true);
    expect(s.hero.energy).toBe(1);
    const r = playCard(s, content, s.piles.hand[0]!.uid, e);
    expect(r).toEqual({ ok: false, reason: 'energy' });
  });

  it('X-cost cards spend everything', () => {
    const s = fight(Array(10).fill('test-x'), ['dummy-brute']);
    const hp = s.enemies[0]!.hp;
    expect(playCard(s, content, s.piles.hand[0]!.uid).ok).toBe(true);
    expect(s.hero.energy).toBe(0);
    expect(hp - s.enemies[0]!.hp).toBe(5 + 5 * 3);
  });

  it('refuses a targeted card without a target and never fizzles it', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute']);
    const uid = s.piles.hand[0]!.uid;
    expect(playCard(s, content, uid)).toEqual({ ok: false, reason: 'needs-target' });
    expect(playCard(s, content, uid, 'nope')).toEqual({ ok: false, reason: 'bad-target' });
    expect(s.hero.energy).toBe(3);
    expect(s.piles.hand.find((c) => c.uid === uid)).toBeDefined();
  });

  it('reshuffles the discard pile when the draw pile runs dry', () => {
    const s = fight(Array(7).fill('strike'), ['dummy-brute']);
    playAll(s, 'strike');
    endTurn(s, content);
    expect(s.turn).toBe(2);
    expect(s.piles.hand.length).toBe(5);
    expect(types(s.events)).toContain('shuffle');
    expect(s.piles.draw.length + s.piles.hand.length + s.piles.discard.length).toBe(7);
  });

  it('block expires at the start of your turn', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    playAll(s, 'defend');
    expect(s.hero.block).toBe(15);
    endTurn(s, content);
    expect(s.hero.block).toBe(0);
  });

  it('is deterministic: same seed and inputs, same event log', () => {
    const run = () => {
      const s = fight(['strike', 'strike', 'defend', 'missiles', 'cleave', 'bash', 'twin-strike', 'strike', 'defend', 'quick-jab'], ['dummy-cur', 'dummy-wisp', 'dummy-wisp'], 'det');
      const log: CombatEvent[] = [];
      for (let t = 0; t < 6 && s.phase === 'player'; t++) {
        for (const p of legalPlays(s, content).slice(0, 2)) playCard(s, content, p.uid, p.targetId);
        endTurn(s, content);
        log.push(...drainEvents(s));
      }
      return JSON.stringify(log);
    };
    expect(run()).toBe(run());
  });
});

describe('damage maths', () => {
  it('applies Strength per hit and Vulnerable multiplicatively', () => {
    const s = fight(Array(10).fill('twin-strike'), ['dummy-brute']);
    const e = s.enemies[0]!;
    applyStatus(s, content, 'hero', 'strength', 2);
    applyStatus(s, content, e.id, 'vulnerable', 1);
    const hp = e.hp;
    playAll(s, 'twin-strike');
    // 3 energy → 3 cards × 2 hits × floor((5+2)×1.5)=10
    expect(hp - e.hp).toBe(60);
  });

  it('Weak reduces outgoing, block absorbs first, Thorns hits back', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute']);
    const e = s.enemies[0]!;
    applyStatus(s, content, 'hero', 'weak', 1);
    applyStatus(s, content, e.id, 'thorns', 2);
    e.block = 3;
    playAll(s, 'strike');
    // 3 strikes at floor(6×0.75)=4: first eats 3 block then 1 hp, then 4, 4 → 9 hp
    expect(e.hp).toBe(60 - 9);
    expect(s.hero.hp).toBe(80 - 6);
  });

  it('Mark adds damage and is consumed per hit', () => {
    const s = fight(Array(10).fill('twin-strike'), ['dummy-brute']);
    const e = s.enemies[0]!;
    applyStatus(s, content, e.id, 'mark', 1);
    const hp = e.hp;
    playAll(s, 'twin-strike');
    expect(hp - e.hp).toBe(5 + 3 + 5 * 5);
    expect(getStatus(e.statuses, 'mark')).toBe(0);
  });

  it('Intangible caps any hit at 1, Images negate hero-bound attacks', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    s.enemies[0]!.intent = { move: 'slam', kind: 'attack', hidden: false };
    applyStatus(s, content, 'hero', 'intangible', 1);
    endTurn(s, content);
    expect(s.hero.hp).toBe(79);
    applyStatus(s, content, 'hero', 'images', 1);
    const hp = s.hero.hp;
    for (const e of s.enemies) e.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(s.hero.hp).toBe(hp);
    expect(getStatus(s.hero.statuses, 'images')).toBe(0);
  });
});

describe('statuses over time', () => {
  it('Poison ignores block and decays; Burn respects block and decays', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    const e = s.enemies[0]!;
    applyStatus(s, content, e.id, 'poison', 3);
    applyStatus(s, content, e.id, 'burn', 2);
    e.block = 50;
    endTurn(s, content);
    expect(e.hp).toBe(57); // poison 3 through block; burn 2 into block
    expect(getStatus(e.statuses, 'poison')).toBe(2);
    expect(getStatus(e.statuses, 'burn')).toBe(1);
  });

  it('Vulnerable, Weak and Frail wear off by one at the end of the holder\'s turn', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    applyStatus(s, content, 'hero', 'frail', 2);
    applyStatus(s, content, s.enemies[0]!.id, 'weak', 1);
    playAll(s, 'defend');
    expect(s.hero.block).toBe(3 * Math.floor(5 * 0.75));
    endTurn(s, content);
    expect(getStatus(s.hero.statuses, 'frail')).toBe(1);
    expect(getStatus(s.enemies[0]!.statuses, 'weak')).toBe(0);
  });

  it('a debuff an enemy applies on its turn lasts through your next turn', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-slime'], 'fresh');
    const e = s.enemies[0]!;
    e.intent = { move: 'smear', kind: 'debuff', hidden: false };
    endTurn(s, content);
    expect(getStatus(s.hero.statuses, 'weak')).toBe(1);
    const hp = e.hp;
    playAll(s, 'strike');
    expect(hp - e.hp).toBe(3 * 4); // weakened strikes
    e.intent = { move: 'splat', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(getStatus(s.hero.statuses, 'weak')).toBe(0);
  });

  it('Artifact eats a debuff', () => {
    const s = fight(Array(10).fill('trip'), ['dummy-boss']);
    const e = s.enemies[0]!;
    expect(getStatus(e.statuses, 'artifact')).toBe(1);
    playAll(s, 'trip');
    expect(getStatus(e.statuses, 'artifact')).toBe(0);
    expect(getStatus(e.statuses, 'vulnerable')).toBe(2 * 2);
  });

  it('Chill reduces hits flat, freezes a normal enemy at 5, and Shatters a boss', () => {
    const s = fight(Array(10).fill('test-frost'), ['dummy-brute', 'dummy-boss']);
    const [brute, boss] = s.enemies as [CombatState['enemies'][0], CombatState['enemies'][0]];
    applyStatus(s, content, brute.id, 'chill', 4);
    brute.intent = { move: 'slam', kind: 'attack', hidden: false };
    boss.intent = { move: 'crush', kind: 'attack', hidden: false };
    applyStatus(s, content, 'hero', 'chill', 100); // cannot hurt us: chill on hero reduces our own hits
    endTurn(s, content);
    expect(s.hero.hp).toBe(80 - (10 - 4) - 12);
    // now push brute over the threshold
    applyStatus(s, content, brute.id, 'chill', 5);
    expect(getStatus(brute.statuses, 'frozen')).toBe(1);
    expect(getStatus(brute.statuses, 'chill')).toBe(0);
    boss.statuses = {};
    const hp = boss.hp;
    applyStatus(s, content, boss.id, 'chill', 5);
    expect(boss.hp).toBe(hp - 15);
    expect(getStatus(boss.statuses, 'frozen')).toBe(0);
  });

  it('a Frozen enemy skips its action', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    const e = s.enemies[0]!;
    e.intent = { move: 'slam', kind: 'attack', hidden: false };
    applyStatus(s, content, e.id, 'frozen', 1);
    endTurn(s, content);
    expect(s.hero.hp).toBe(80);
    expect(s.events.some((ev) => ev.t === 'enemyAct' && ev.skipped === 'frozen')).toBe(true);
  });

  it('Plated Armor and Metallicize add block at end of turn; Plated loses one per HP hit', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute']);
    const e = s.enemies[0]!;
    applyStatus(s, content, e.id, 'platedArmor', 3);
    playAll(s, 'strike');
    expect(getStatus(e.statuses, 'platedArmor')).toBe(0);
    applyStatus(s, content, e.id, 'metallicize', 4);
    e.intent = { move: 'guard', kind: 'defend', hidden: false };
    endTurn(s, content);
    // Enemy block is cleared at the start of the hero's turn, so check the event.
    expect(s.events.some((ev) => ev.t === 'block' && ev.target === e.id && ev.amount === 4)).toBe(true);
  });

  it('Regen heals then decays; Ritual grows Strength; Enrage punishes Skills', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute']);
    const e = s.enemies[0]!;
    e.hp = 30;
    applyStatus(s, content, e.id, 'regen', 3);
    applyStatus(s, content, e.id, 'ritual', 2);
    applyStatus(s, content, e.id, 'enrage', 1);
    playAll(s, 'defend');
    expect(getStatus(e.statuses, 'strength')).toBe(3);
    e.intent = { move: 'guard', kind: 'defend', hidden: false };
    endTurn(s, content);
    expect(e.hp).toBe(33);
    expect(getStatus(e.statuses, 'regen')).toBe(2);
    expect(getStatus(e.statuses, 'strength')).toBe(5);
  });
});

describe('resources, powers, traps, companion', () => {
  it('Holy Power builds, caps at 5, and a spender scales with what it spends', () => {
    const s = fight([...Array(6).fill('test-generator'), ...Array(4).fill('test-verdict')], ['dummy-boss'], 'hopo');
    const e = s.enemies[0]!;
    for (let t = 0; t < 3; t++) {
      playAll(s, 'test-generator');
      endTurn(s, content);
    }
    expect(s.hero.resources.holyPower).toBeLessThanOrEqual(5);
    // Force a known state and spend.
    s.hero.resources.holyPower = 5;
    s.hero.energy = 3;
    const inst = s.piles.hand.find((c) => c.cardId === 'test-verdict') ?? s.piles.draw.find((c) => c.cardId === 'test-verdict')!;
    if (!s.piles.hand.includes(inst)) {
      s.piles.draw.splice(s.piles.draw.indexOf(inst), 1);
      s.piles.hand.push(inst);
    }
    const hp = e.hp;
    e.statuses = {};
    expect(playCard(s, content, inst.uid, e.id).ok).toBe(true);
    expect(hp - e.hp).toBe(5 + 4 * 5);
    expect(s.hero.resources.holyPower).toBe(0);
  });

  it('a Power triggers at end of turn and the card leaves the piles', () => {
    const s = fight(Array(10).fill('test-power'), ['dummy-brute', 'dummy-cur']);
    playAll(s, 'test-power');
    expect(s.hero.powers.length).toBe(3);
    expect(s.piles.discard.length).toBe(0);
    const hp = s.enemies.map((e) => e.hp);
    endTurn(s, content);
    expect(s.enemies[0]!.hp).toBeLessThanOrEqual(hp[0]! - 9);
    expect(s.enemies[1]!.hp).toBeLessThanOrEqual(hp[1]! - 9);
  });

  it('a Trap arms, holds at two, and fires when an enemy attacks', () => {
    const s = fight(Array(10).fill('test-trap'), ['dummy-brute']);
    const e = s.enemies[0]!;
    playAll(s, 'test-trap');
    expect(s.hero.traps.length).toBe(2);
    expect(s.events.filter((ev) => ev.t === 'trap' && ev.state === 'replaced').length).toBe(1);
    e.intent = { move: 'slam', kind: 'attack', hidden: false };
    const hp = e.hp;
    endTurn(s, content);
    expect(hp - e.hp).toBe(16);
    expect(s.hero.traps.length).toBe(0);
    expect(s.hero.hp).toBe(70);
  });

  it('the Companion acts at end of turn and on Sic, and Stun costs it an action', () => {
    const s = fight(Array(10).fill('test-sic'), ['dummy-brute'], 'wolf', { classId: 'tracker', companion: 'wolf' });
    const e = s.enemies[0]!;
    e.intent = { move: 'guard', kind: 'defend', hidden: false };
    const hp = e.hp;
    playAll(s, 'test-sic');
    expect(hp - e.hp).toBe(15);
    s.hero.companion!.stunned = true;
    endTurn(s, content);
    expect(e.hp).toBe(hp - 15); // stunned: no end-of-turn bite
    expect(s.hero.companion!.stunned).toBe(false);
  });
});

describe('prompts and card hooks', () => {
  it('a choose-discard opens a prompt, blocks play, and resumes', () => {
    const s = fight([...Array(9).fill('strike'), 'second-look'], ['dummy-brute'], 'look');
    const inst = s.piles.hand.find((c) => c.cardId === 'second-look') ?? s.piles.draw.find((c) => c.cardId === 'second-look')!;
    if (!s.piles.hand.includes(inst)) {
      s.piles.draw.splice(s.piles.draw.indexOf(inst), 1);
      s.piles.hand.push(inst);
    }
    expect(playCard(s, content, inst.uid).ok).toBe(true);
    expect(s.prompt?.kind).toBe('discard');
    expect(s.inPlay).not.toBeNull();
    expect(endTurn(s, content)).toBe(false);
    expect(playCard(s, content, s.piles.hand[0]!.uid, s.enemies[0]!.id)).toEqual({ ok: false, reason: 'prompt-open' });
    expect(respondPrompt(s, content, [s.piles.hand[0]!.uid])).toBe(true);
    expect(s.prompt).toBeNull();
    expect(s.inPlay).toBeNull();
    expect(s.piles.discard.map((c) => c.cardId)).toContain('second-look');
  });

  it('Exhaust removes the card for the fight; Retain and Ethereal do their jobs', () => {
    const s = fight(['test-exhaust', 'pride', 'torn-page', 'strike', 'strike', 'strike', 'strike'], ['dummy-brute'], 'kw');
    // Everything is in hand or draw; pull the three specials into hand.
    for (const id of ['test-exhaust', 'pride', 'torn-page']) {
      const inst = s.piles.draw.find((c) => c.cardId === id);
      if (inst) {
        s.piles.draw.splice(s.piles.draw.indexOf(inst), 1);
        s.piles.hand.push(inst);
      }
    }
    playAll(s, 'test-exhaust');
    expect(s.piles.exhaust.map((c) => c.cardId)).toEqual(['test-exhaust']);
    s.enemies[0]!.intent = { move: 'guard', kind: 'defend', hidden: false };
    endTurn(s, content);
    expect(s.piles.exhaust.map((c) => c.cardId).sort()).toEqual(['test-exhaust', 'torn-page']);
    expect(handIds(s)).toContain('pride');
    expect(s.hero.hp).toBe(78); // Pride bit us at end of turn
  });

  it('Smudge hurts when drawn and Debt costs gold at fight start', () => {
    const s = fight(['smudge', 'debt', 'strike', 'strike', 'strike'], ['dummy-brute'], 'curse', { gold: 50 });
    expect(s.hero.gold).toBe(45);
    expect(s.hero.hp).toBe(79);
  });
});

describe('enemies', () => {
  it('cycles its pattern, honours once, and hides a hidden move', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute'], 'cycle');
    const e = s.enemies[0]!;
    const seen: string[] = [e.intent!.move];
    for (let t = 0; t < 7; t++) {
      endTurn(s, content);
      seen.push(e.intent!.move);
    }
    expect(seen.slice(0, 4)).toEqual(['guard', 'slam', 'slam', 'rally']);
    expect(seen.slice(4, 8)).toEqual(['guard', 'slam', 'slam', 'guard']); // rally was once
    const b = fight(Array(10).fill('defend'), ['dummy-boss'], 'hide');
    const boss = b.enemies[0]!;
    endTurn(b, content);
    endTurn(b, content);
    expect(boss.intent!.move).toBe('hidden-strike');
    expect(boss.intent!.hidden).toBe(true);
  });

  it('weighted patterns respect requires and no-repeat', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-cur'], 'weighted');
    const e = s.enemies[0]!;
    const seen: string[] = [e.intent!.move];
    for (let t = 0; t < 30; t++) {
      endTurn(s, content);
      if (s.phase !== 'player') break;
      seen.push(e.intent!.move);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    const firstLunge = seen.indexOf('lunge');
    const firstHowl = seen.indexOf('howl');
    if (firstLunge >= 0) expect(firstHowl).toBeLessThan(firstLunge);
  });

  it('enters a phase below the threshold and plays its entry move', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-boss'], 'phase');
    const e = s.enemies[0]!;
    e.hp = 50;
    endTurn(s, content);
    expect(e.phase).toBe(0);
    expect(e.intent!.move).toBe('enrage');
    expect(s.events.some((ev) => ev.t === 'phase')).toBe(true);
  });

  it('summons up to a cap, and the split script divides a slime', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-boss'], 'summon');
    const boss = s.enemies[0]!;
    boss.intent = { move: 'spill', kind: 'summon', hidden: false };
    endTurn(s, content);
    expect(s.enemies.filter((e) => e.alive).length).toBe(2);
    expect(s.enemies[1]!.enemyId).toBe('dummy-inkling');

    const t = fight(Array(10).fill('defend'), ['dummy-slime'], 'split');
    const slime = t.enemies[0]!;
    slime.hp = 10;
    endTurn(t, content); // chooses divide on entering the phase
    expect(slime.intent!.move).toBe('divide');
    endTurn(t, content); // divide resolves
    expect(slime.alive).toBe(false);
    const kids = t.enemies.filter((e) => e.alive);
    expect(kids.length).toBe(2);
    expect(kids.every((k) => k.enemyId === 'dummy-inkling' && k.hp === 10)).toBe(true);
  });

  it('the intent preview matches the damage that lands', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute'], 'preview');
    const e = s.enemies[0]!;
    applyStatus(s, content, e.id, 'strength', 3);
    applyStatus(s, content, 'hero', 'vulnerable', 2);
    e.intent = null;
    e.history = ['guard']; // next is slam
    chooseIntent(s, content, e);
    expect(e.intent!.move).toBe('slam');
    const shown = e.intent!.damage!;
    endTurn(s, content);
    expect(80 - s.hero.hp).toBe(shown);
  });
});

describe('ending', () => {
  it('wins when the last enemy dies, mid-card, and ignores further plays', () => {
    const s = fight(Array(10).fill('cleave'), ['dummy-wisp', 'dummy-wisp'], 'win');
    playAll(s, 'cleave');
    expect(s.phase).toBe('won');
    expect(types(s.events)).toContain('end');
    expect(playCard(s, content, s.piles.hand[0]?.uid ?? -1)).toEqual({ ok: false, reason: 'not-your-turn' });
  });

  it('loses at zero HP and a once-per-fight revive saves you at 30%', () => {
    const s = fight(Array(10).fill('defend'), ['dummy-brute'], 'lose');
    s.hero.hp = 5;
    s.enemies[0]!.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(s.phase).toBe('lost');
    const r = fight(Array(10).fill('defend'), ['dummy-brute'], 'revive');
    r.hero.hp = 5;
    r.hero.flags.reviveOnce = true;
    r.enemies[0]!.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(r, content);
    expect(r.phase).toBe('player');
    expect(r.hero.hp).toBe(24);
  });
});

describe('events', () => {
  it('a scripted exchange emits the expected sequence', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute'], 'log');
    drainEvents(s);
    const e = s.enemies[0]!;
    playCard(s, content, s.piles.hand[0]!.uid, e.id);
    const seq = types(drainEvents(s));
    expect(seq).toEqual(['energy', 'play', 'damage', 'cardMoved']);
    e.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(s, content);
    const turn = types(drainEvents(s));
    expect(turn.slice(0, 5)).toEqual(['cardMoved', 'cardMoved', 'cardMoved', 'cardMoved', 'turnStart']);
    expect(turn).toContain('enemyAct');
    expect(turn).toContain('damage');
    expect(turn).toContain('intent');
    expect(turn[turn.length - 1]).toBe('draw');
  });

  it('the state round-trips through JSON', () => {
    const s = fight(Array(10).fill('strike'), ['dummy-brute'], 'json');
    const copy = JSON.parse(JSON.stringify(s));
    expect(copy.hero.hp).toBe(80);
    expect(copy.rng.shuffle.length).toBe(4);
    expect(copy.piles.hand.length).toBe(5);
  });
});
