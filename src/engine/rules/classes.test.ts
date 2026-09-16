import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { applyStatus, createCombat, endTurn, getStatus, playCard, whyUnplayable, type CombatState, type HeroSetup } from './index';

const content = loadContent({ fixtures: true });

function fight(classId: HeroSetup['classId'], deck: string[], enemies: string[], seed = 'cls', extra: Partial<HeroSetup> = {}): CombatState {
  const def = content.classes[classId]!;
  return createCombat(content, { classId, maxHp: def.hp, deck: deck.map((cardId) => ({ cardId })), companion: def.companion, ...extra }, { enemies }, seed);
}

/** Pull a card into the hand (from anywhere) so a test can play it deterministically. */
function toHand(s: CombatState, cardId: string) {
  let inst = s.piles.hand.find((c) => c.cardId === cardId);
  if (inst) return inst;
  for (const pile of [s.piles.draw, s.piles.discard]) {
    inst = pile.find((c) => c.cardId === cardId);
    if (inst) {
      pile.splice(pile.indexOf(inst), 1);
      s.piles.hand.push(inst);
      return inst;
    }
  }
  throw new Error(`no ${cardId} in the fight`);
}

function play(s: CombatState, cardId: string, targetId?: string) {
  const inst = toHand(s, cardId);
  const card = content.cards[cardId]!;
  const r = playCard(s, content, inst.uid, card.target === 'enemy' ? (targetId ?? s.enemies.find((e) => e.alive)!.id) : undefined);
  if (!r.ok) throw new Error(`${cardId}: ${r.reason}`);
}

describe('Paladin', () => {
  it('starts with its starter deck and builds then spends Holy Power', () => {
    const s = fight('paladin', content.classes['paladin']!.starter, ['dummy-boss']);
    const e = s.enemies[0]!;
    e.statuses = {};
    s.hero.energy = 10;
    play(s, 'crusader-strike');
    play(s, 'shield-of-the-righteous');
    expect(s.hero.resources.holyPower).toBe(2);
    s.hero.resources.holyPower = 3;
    const hp = e.hp;
    play(s, 'hammer-blow');
    expect(hp - e.hp).toBe(6);
  });

  it('Judgment checks Holy Power before it adds; Avenger’s Shield goes wide at 3', () => {
    const s = fight('paladin', ['judgment', 'avengers-shield', 'hammer-blow', 'hammer-blow', 'hammer-blow'], ['dummy-cur', 'dummy-cur']);
    const [a, b] = s.enemies as [CombatState['enemies'][0], CombatState['enemies'][0]];
    s.hero.energy = 10;
    s.hero.resources.holyPower = 2;
    play(s, 'judgment', a.id);
    expect(getStatus(a.statuses, 'vulnerable')).toBe(0);
    expect(s.hero.resources.holyPower).toBe(3);
    play(s, 'avengers-shield', a.id);
    expect(getStatus(a.statuses, 'weak')).toBe(1);
    expect(getStatus(b.statuses, 'weak')).toBe(1);
  });

  it('Hammer of Wrath costs 0 below half HP and 2 otherwise', () => {
    const s = fight('paladin', ['hammer-of-wrath', 'hammer-blow', 'hammer-blow', 'hammer-blow', 'hammer-blow'], ['dummy-brute']);
    const e = s.enemies[0]!;
    const inst = toHand(s, 'hammer-of-wrath');
    s.hero.energy = 1;
    expect(whyUnplayable(s, content, inst.uid, e.id)).toBe('energy');
    e.hp = 20;
    expect(whyUnplayable(s, content, inst.uid, e.id)).toBeNull();
    play(s, 'hammer-of-wrath', e.id);
    expect(s.hero.energy).toBe(1);
    expect(e.hp).toBe(6);
  });

  it('Holy Wrath hits for your block; Righteous Fury blocks on every gain', () => {
    const s = fight('paladin', ['holy-wrath', 'righteous-fury', 'bulwark', 'crusader-strike', 'raise-shield'], ['dummy-brute']);
    const e = s.enemies[0]!;
    s.hero.energy = 10;
    play(s, 'righteous-fury');
    play(s, 'bulwark');
    expect(s.hero.block).toBe(14);
    play(s, 'crusader-strike');
    expect(s.hero.block).toBe(16); // +2 from Righteous Fury on the Holy Power gain
    const hp = e.hp;
    play(s, 'holy-wrath');
    expect(hp - e.hp).toBe(16);
  });
});

describe('Tracker', () => {
  it('Marks add damage per hit and Trueshot stacks on it', () => {
    const s = fight('tracker', ['hunters-mark', 'rapid-fire', 'trueshot', 'arrow', 'arrow'], ['dummy-brute']);
    const e = s.enemies[0]!;
    s.hero.energy = 10;
    play(s, 'trueshot');
    play(s, 'hunters-mark');
    const hp = e.hp;
    play(s, 'rapid-fire');
    expect(hp - e.hp).toBe(3 * (3 + 3 + 2));
    expect(getStatus(e.statuses, 'mark')).toBe(0);
  });

  it('Feed, Kill Command and Growl drive the Companion', () => {
    const s = fight('tracker', ['feed', 'kill-command', 'growl', 'sic-em', 'arrow'], ['dummy-brute']);
    const e = s.enemies[0]!;
    e.intent = { move: 'guard', kind: 'defend', hidden: false };
    s.hero.energy = 10;
    play(s, 'feed');
    expect(s.hero.companion!.bonus).toBe(2);
    let hp = e.hp;
    play(s, 'kill-command');
    expect(hp - e.hp).toBe(5 + 2 + 4);
    play(s, 'growl');
    expect(s.hero.companion!.enraged).toBe(true);
    hp = e.hp;
    play(s, 'sic-em');
    expect(hp - e.hp).toBe(5 + 2 + 3);
    expect(s.hero.companion!.enraged).toBe(false);
  });

  it('Freezing Trap negates the attack; Viper’s Kiss fattens Poison; Kill Shot needs a wounded target', () => {
    const s = fight('tracker', ['freezing-trap', 'vipers-kiss', 'serpent-sting', 'kill-shot', 'arrow'], ['dummy-brute']);
    const e = s.enemies[0]!;
    s.hero.energy = 10;
    play(s, 'vipers-kiss');
    play(s, 'serpent-sting');
    expect(getStatus(e.statuses, 'poison')).toBe(4);
    const ks = toHand(s, 'kill-shot');
    expect(whyUnplayable(s, content, ks.uid, e.id)).toBe('condition');
    play(s, 'freezing-trap');
    e.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(s.hero.hp).toBe(70);
    expect(s.events.some((ev) => ev.t === 'negated' && ev.by === 'trap')).toBe(true);
  });

  it('Bestial Wrath makes the Companion act at the start of the turn too', () => {
    const s = fight('tracker', ['bestial-wrath', 'brace', 'brace', 'brace', 'brace', 'brace'], ['dummy-brute']);
    const e = s.enemies[0]!;
    e.intent = { move: 'guard', kind: 'defend', hidden: false };
    play(s, 'bestial-wrath');
    const hp = e.hp;
    endTurn(s, content);
    // end of turn bite + start of next turn bite, both into a fresh 8 block
    expect(hp - e.hp).toBeGreaterThanOrEqual(2);
    expect(s.events.filter((ev) => ev.t === 'companion' && ev.action === 'act').length).toBe(2);
  });
});

describe('Mage', () => {
  it('Charges scale Arcane Blast and Mana Shield, and Barrage spends them', () => {
    const s = fight('mage', ['arcane-blast', 'arcane-blast', 'mana-shield', 'arcane-barrage', 'arcane-bolt'], ['dummy-brute', 'dummy-cur']);
    const [a, b] = s.enemies as [CombatState['enemies'][0], CombatState['enemies'][0]];
    s.hero.energy = 10;
    let hp = a.hp;
    play(s, 'arcane-blast', a.id);
    expect(hp - a.hp).toBe(6);
    expect(s.hero.resources.charge).toBe(1);
    hp = a.hp;
    play(s, 'arcane-blast', a.id);
    expect(hp - a.hp).toBe(8);
    play(s, 'mana-shield');
    expect(s.hero.block).toBe(6 + 4);
    const hb = b.hp;
    play(s, 'arcane-barrage');
    expect(hb - b.hp).toBe(4 + 4 * 2);
    expect(s.hero.resources.charge).toBe(0);
  });

  it('Burn stacks and Combustion cashes it in; Ignite adds Burn to Fire Attacks', () => {
    const s = fight('mage', ['ignite', 'scorch', 'combustion', 'fireball', 'ice-barrier'], ['dummy-brute']);
    const e = s.enemies[0]!;
    s.hero.energy = 10;
    play(s, 'ignite');
    play(s, 'scorch');
    expect(getStatus(e.statuses, 'burn')).toBe(3);
    const hp = e.hp;
    play(s, 'combustion');
    expect(hp - e.hp).toBe(9);
    expect(getStatus(e.statuses, 'burn')).toBe(0);
  });

  it('Chill freezes at five, Frozen enemies skip and take the big Shatter; Frost Armor chills attackers', () => {
    const s = fight('mage', ['frost-nova', 'frostbolt', 'frostbolt', 'shatter', 'frost-armor', 'glacial-spike'], ['dummy-brute']);
    const e = s.enemies[0]!;
    s.hero.energy = 10;
    play(s, 'frost-armor');
    play(s, 'frost-nova');
    play(s, 'frostbolt');
    expect(getStatus(e.statuses, 'chill')).toBe(4);
    play(s, 'frostbolt');
    expect(getStatus(e.statuses, 'frozen')).toBe(1);
    expect(getStatus(e.statuses, 'chill')).toBe(0);
    const hp = e.hp;
    play(s, 'glacial-spike');
    expect(hp - e.hp).toBe(30);
    e.intent = { move: 'slam', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(s.hero.hp).toBe(65); // it was Frozen, so it skipped
    expect(getStatus(e.statuses, 'frozen')).toBe(0);
  });

  it('Living Bomb blows up the neighbours when its host dies', () => {
    const s = fight('mage', ['living-bomb', 'pyroblast', 'arcane-bolt', 'arcane-bolt', 'arcane-bolt'], ['dummy-wisp', 'dummy-wisp', 'dummy-wisp']);
    const [a, b, c] = s.enemies as [CombatState['enemies'][0], CombatState['enemies'][0], CombatState['enemies'][0]];
    s.hero.energy = 10;
    const hb = b.hp;
    const hc = c.hp;
    play(s, 'living-bomb', a.id);
    play(s, 'pyroblast', a.id);
    expect(a.alive).toBe(false);
    expect(hb - b.hp).toBe(10);
    expect(hc - c.hp).toBe(10);
  });

  it('Mirror Image absorbs two attacks, Deep Freeze shatters a boss', () => {
    const s = fight('mage', ['mirror-image', 'deep-freeze', 'ice-barrier', 'ice-barrier', 'ice-barrier'], ['dummy-boss']);
    const e = s.enemies[0]!;
    e.statuses = {};
    s.hero.energy = 10;
    play(s, 'mirror-image');
    const hp = e.hp;
    play(s, 'deep-freeze');
    expect(hp - e.hp).toBe(15);
    e.intent = { move: 'crush', kind: 'attack', hidden: false };
    endTurn(s, content);
    expect(s.hero.hp).toBe(65);
    expect(getStatus(s.hero.statuses, 'images')).toBe(1);
  });
});

describe('every class starter deck is legal and draws five', () => {
  for (const cls of Object.values(content.classes)) {
    it(cls.id, () => {
      const s = fight(cls.id, cls.starter, ['dummy-brute']);
      expect(s.piles.hand.length).toBe(5);
      expect(s.hero.maxHp).toBe(cls.hp);
      applyStatus(s, content, 'hero', 'strength', 0);
    });
  }
});
