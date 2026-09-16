import { describe, expect, it } from 'vitest';
import { loadContent } from './index';
import art from './generated/art.json';
import { Card, Effect } from './schema';
import { ArtManifest } from './schema/art';

describe('content', () => {
  const content = loadContent({ fixtures: true });

  it('loads every file and every entry validates', () => {
    expect(Object.keys(content.cards).length).toBeGreaterThan(20);
    expect(Object.keys(content.enemies).length).toBeGreaterThan(4);
  });

  it('every card has an upgrade object and a script card has text', () => {
    for (const card of Object.values(content.cards)) {
      expect(card.upgrade, card.id).toBeDefined();
      const hasScript = JSON.stringify(card.effects).includes('"do":"script"');
      if (hasScript) expect(card.text, `${card.id} uses a script and needs text`).toBeTruthy();
    }
  });

  it('every enemy move references only known enemies in summons, and patterns name real moves', () => {
    for (const e of Object.values(content.enemies)) {
      const names = (p: typeof e.pattern) => (p.type === 'cycle' ? p.moves : p.type === 'weighted' ? Object.keys(p.moves) : []);
      for (const m of names(e.pattern)) expect(e.moves[m], `${e.id}.${m}`).toBeDefined();
      for (const ph of e.phases ?? []) {
        for (const m of names(ph.pattern)) expect(e.moves[m], `${e.id}.${m}`).toBeDefined();
        if (ph.onEnter) expect(e.moves[ph.onEnter], `${e.id}.${ph.onEnter}`).toBeDefined();
      }
      for (const m of Object.values(e.moves)) {
        for (const ef of m.effects) if (ef.do === 'summon') expect(content.enemies[ef.enemy], `${e.id} summons ${ef.enemy}`).toBeDefined();
      }
    }
  });

  it('the art manifest validates and every artist in it has a credit', () => {
    const m = ArtManifest.parse(art);
    for (const [id, e] of Object.entries(m.enemies)) expect(content.credits[e.artist], `${id} drawn by unknown ${e.artist}`).toBeDefined();
  });

  it('every enemy that ships (has a chapter) has art, a credit and a Secret', () => {
    const m = ArtManifest.parse(art);
    for (const e of Object.values(content.enemies)) {
      if (!e.chapter) continue;
      expect(m.enemies[e.id], `${e.id} has no art in public/art/enemies`).toBeDefined();
      expect(e.artist && content.credits[e.artist], `${e.id} has no credited artist`).toBeTruthy();
      expect(e.secret && content.cards[e.secret], `${e.id} has no Secret card`).toBeTruthy();
    }
  });

  it('rejects an unknown effect and an extra field', () => {
    expect(Effect.safeParse({ do: 'explode' }).success).toBe(false);
    expect(Effect.safeParse({ do: 'damage', amount: 5, target: 'target', bogus: 1 }).success).toBe(false);
    expect(Card.safeParse({ ...content.cards['strike'], id: 'Bad Id' }).success).toBe(false);
  });
});
