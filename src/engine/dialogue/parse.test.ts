import { describe, expect, it } from 'vitest';
import { parseDialogue } from './parse';

const SAMPLE = `title: A Torn Page
portrait left: seeker
portrait right: archivist mood=sly

archivist: A page, torn from something older than this place. Take it?
seeker: What's the catch?
There is always a catch.

choice:
  - Take the page  -> take
  - Leave it       -> leave
  - [if gold >= 50] Buy it, 50 gold -> buy

@take
  > relic random common
  > curse doubt
  archivist: Wise. Foolish. Both.
  > end

@leave
  > end

@buy
  > gold -50
  > goto @take
`;

describe('dialogue parser', () => {
  it('reads title, portraits, lines, continuation, choices, sections and effects', () => {
    const s = parseDialogue(SAMPLE);
    expect(s.title).toBe('A Torn Page');
    expect(s.portraits.right).toEqual({ id: 'archivist', mood: 'sly' });
    const body = s.sections['']!;
    expect(body[0]).toMatchObject({ kind: 'say', speaker: 'archivist' });
    expect(body[2]).toMatchObject({ kind: 'say', speaker: 'seeker', text: 'There is always a catch.' });
    expect(body[3]).toMatchObject({ kind: 'choice' });
    const choice = body[3] as Extract<(typeof body)[number], { kind: 'choice' }>;
    expect(choice.options.length).toBe(3);
    expect(choice.options[2]).toEqual({ label: 'Buy it, 50 gold', target: 'buy', cond: 'gold >= 50' });
    expect(s.sections['take']![0]).toEqual({ kind: 'effect', op: 'relic', args: ['random', 'common'], line: 15 });
    expect(s.sections['buy']![1]).toMatchObject({ kind: 'goto', target: 'take' });
  });

  it('names the line of a broken reference', () => {
    expect(() => parseDialogue('choice:\n  - Go -> nowhere\n')).toThrow(/line 1/);
    expect(() => parseDialogue('> goto @missing\n')).toThrow(/no such section/);
  });
});
