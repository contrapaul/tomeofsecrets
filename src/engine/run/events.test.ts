import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { parseDialogue } from '../dialogue/parse';
import { playFight } from '../ai/heuristic';
import { advance, choose, knownEvents, pick, startDialogue } from './events';
import { createRun, finishFight, finishReward } from './run';

const content = loadContent();

describe('events', () => {
  it('every .dlg parses and every fight/curse/relic it names exists', () => {
    for (const [name, src] of Object.entries(content.events)) {
      const script = parseDialogue(src);
      for (const lines of Object.values(script.sections)) {
        for (const l of lines) {
          if (l.kind !== 'effect') continue;
          if (l.op === 'fight') for (const e of l.args[0]!.split(',')) expect(content.enemies[e], `${name}: fight ${e}`).toBeDefined();
          if (l.op === 'curse') expect(content.cards[l.args[0]!]?.type, `${name}: curse ${l.args[0]}`).toBe('curse');
          if (l.op === 'relic' && l.args[0] !== 'random') expect(content.relics[l.args[0]!], `${name}: relic ${l.args[0]}`).toBeDefined();
          if (l.op === 'card' && l.args[0] === 'add' && l.args[1] !== 'random') expect(content.cards[l.args[1]!], `${name}: card ${l.args[1]}`).toBeDefined();
        }
      }
    }
    expect(Object.keys(content.events).length).toBe(12);
  });

  it('a torn page: a choice is hidden until you can afford it, and taking it pays out', () => {
    const run = createRun(content, { classId: 'paladin', seed: 'ev1' });
    run.hero.gold = 10;
    expect(knownEvents()).toContain('a-torn-page');
    const st = startDialogue(run, content, 'a-torn-page');
    expect(st.waiting).toBe('continue');
    expect(st.beats[0]).toMatchObject({ kind: 'say', speaker: 'archivist' });
    advance(run, content);
    advance(run, content);
    expect(st.beats[2]).toMatchObject({ text: 'There is always a catch, Paladin.' });
    advance(run, content);
    expect(st.waiting).toBe('choice');
    expect(st.choices.map((c) => c.target)).toEqual(['take', 'leave']);
    const relics = run.hero.relics.length;
    choose(run, content, 0);
    expect(run.hero.relics.length).toBe(relics + 1);
    expect(run.hero.deck.some((c) => c.cardId === 'doubt')).toBe(true);
    advance(run, content);
    expect(st.waiting).toBe('done');
  });

  it('a card pick pauses the script and resumes after the answer', () => {
    const run = createRun(content, { classId: 'mage', seed: 'ev2' });
    const st = startDialogue(run, content, 'binding-ritual');
    advance(run, content);
    expect(st.waiting).toBe('choice');
    const hp = run.hero.hp;
    choose(run, content, 0);
    expect(run.hero.hp).toBe(hp - 8);
    expect(st.waiting).toBe('pick');
    expect(st.pick).toMatchObject({ kind: 'remove', count: 1 });
    const before = run.hero.deck.length;
    pick(run, content, [run.hero.deck[0]!.uid]);
    expect(run.hero.deck.length).toBe(before - 1);
    expect(st.waiting).toBe('continue');
  });

  it('a fight from a script returns to the script with a doubled reward', () => {
    const run = createRun(content, { classId: 'tracker', seed: 'ev3' });
    const st = startDialogue(run, content, 'mimic-shelf');
    advance(run, content);
    advance(run, content);
    expect(st.waiting).toBe('choice');
    choose(run, content, 0);
    expect(st.waiting).toBe('fight');
    expect(run.phase).toBe('fight');
    expect(run.fight!.encounter).toEqual(['mossback-beetle', 'page-wisp', 'page-wisp']);
    playFight(run.fight!.state, content);
    expect(run.fight!.state.phase).toBe('won');
    finishFight(run, content);
    expect(run.phase).toBe('reward');
    expect(run.reward!.relic).toBeTruthy();
    finishReward(run, content);
    expect(run.phase).toBe('event');
    expect(run.event!.state.waiting).toBe('continue');
    expect(run.event!.state.beats.at(-1)).toMatchObject({ text: expect.stringContaining('snaps shut') });
  });
});
