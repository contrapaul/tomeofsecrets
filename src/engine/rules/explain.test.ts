import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { IntentKind, Keyword, ResourceName, StatusId } from '../../content/schema';
import { resolveCard } from './cards';
import { explainCard, explainIntent, explainRelic, explainStatus, fillTokens, GLOSSARY_TOKENS, term, termsOfCard, termsOfEffects } from './explain';
import { STATUS_NAMES } from './text';

const content = loadContent();
const NODE_TYPES = ['fight', 'elite', 'event', 'merchant', 'camp', 'treasure', 'unknown', 'boss'];

describe('glossary', () => {
  it('covers every status, keyword, resource, intent kind and node type, with matching names', () => {
    for (const id of StatusId.options) {
      const n = term(content, id);
      expect(n, `status ${id}`).toBeTruthy();
      expect(n!.kind).toBe('status');
      // The engine's own names and the glossary agree, except where the glossary uses the adjective.
      const same = n!.name === STATUS_NAMES[id] || (id === 'stun' && n!.name === 'Stunned') || (id === 'wait' && n!.name === 'Waiting');
      expect(same, `name for ${id}: ${n!.name} vs ${STATUS_NAMES[id]}`).toBe(true);
    }
    for (const k of Keyword.options) expect(term(content, k)?.kind, `keyword ${k}`).toBe('keyword');
    expect(term(content, 'armed')?.kind).toBe('keyword');
    for (const r of ResourceName.options) expect(term(content, r)?.kind, `resource ${r}`).toBe('resource');
    expect(term(content, 'energy')?.kind).toBe('resource');
    for (const k of IntentKind.options) expect(term(content, `intent-${k}`)?.kind, `intent ${k}`).toBe('intent');
    expect(term(content, 'intent-hidden')).toBeTruthy();
    for (const t of NODE_TYPES) expect(term(content, `node-${t}`)?.kind, `node ${t}`).toBe('node');
  });

  it('fills every token from the engine and leaves none behind', () => {
    for (const e of Object.values(content.glossary)) {
      const text = fillTokens(e.text);
      expect(text, e.id).not.toMatch(/\{[A-Za-z_]+\}/);
    }
    expect(fillTokens('At {FREEZE_AT} Chill')).toBe(`At ${GLOSSARY_TOKENS['FREEZE_AT']} Chill`);
    expect(term(content, 'chill')!.text).toContain('At 5 Chill');
  });

  it('every term any card, relic, vial or enemy move touches has an entry', () => {
    const missing = new Set<string>();
    for (const card of Object.values(content.cards)) {
      for (const up of [false, true]) for (const id of termsOfCard(resolveCard(card, up))) if (!term(content, id)) missing.add(`card ${card.id}: ${id}`);
    }
    for (const relic of Object.values(content.relics)) {
      const c = relic.combat;
      for (const list of [c?.fightStart, c?.turnStart]) if (list) for (const id of termsOfEffects(list)) if (!term(content, id)) missing.add(`relic ${relic.id}: ${id}`);
    }
    for (const vial of Object.values(content.vials)) for (const id of termsOfEffects(vial.effects)) if (!term(content, id)) missing.add(`vial ${vial.id}: ${id}`);
    for (const enemy of Object.values(content.enemies)) {
      for (const [mid, move] of Object.entries(enemy.moves)) for (const id of termsOfEffects(move.effects)) if (!term(content, id)) missing.add(`enemy ${enemy.id} ${mid}: ${id}`);
    }
    expect([...missing]).toEqual([]);
  });

  it('every term marked in generated card text exists', () => {
    const missing = new Set<string>();
    for (const card of Object.values(content.cards)) {
      const ex = explainCard(content, resolveCard(card, false));
      for (const seg of ex.body) if (seg.term && !term(content, seg.term)) missing.add(`${card.id}: ${seg.term}`);
    }
    expect([...missing]).toEqual([]);
  });
});

describe('explain', () => {
  it('Judgment: Holy Power and Vulnerable, in the text and in the notes', () => {
    const ex = explainCard(content, resolveCard(content.cards['judgment']!, false));
    expect(ex.notes.map((n) => n.id)).toEqual(['holyPower', 'vulnerable']);
    expect(ex.body.some((s) => s.term === 'vulnerable')).toBe(true);
  });

  it('Snake Trap: Armed, its trigger, and Poison', () => {
    const ex = explainCard(content, resolveCard(content.cards['snake-trap']!, false));
    const ids = ex.notes.map((n) => n.id);
    expect(ids).toContain('armed');
    expect(ids.some((id) => id.startsWith('trap-'))).toBe(true);
    expect(ids).toContain('poison');
  });

  it('an X-cost card explains X; a relic explains the statuses it grants', () => {
    const x = Object.values(content.cards).find((c) => c.cost === 'X');
    if (x) expect(explainCard(content, resolveCard(x, false)).notes[0]!.id).toBe('xcost');
    const bracers = content.relics['thornvine-bracers']!;
    expect(explainRelic(content, bracers).notes.map((n) => n.id)).toContain('thorns');
  });

  it("the Mad Cartographer's Ink Trap says it stuns the Companion; a hidden intent stays hidden", () => {
    const def = content.enemies['mad-cartographer']!;
    const moveId = Object.keys(def.moves).find((m) => /ink-trap|trap/.test(m)) ?? Object.keys(def.moves)[0]!;
    const ex = explainIntent(content, def, { move: moveId, kind: def.moves[moveId]!.intent, hidden: false });
    expect(ex.title).toBe(def.moves[moveId]!.name ?? moveId);
    expect(ex.body.some((s) => s.term === 'stun')).toBe(true);
    expect(ex.notes.map((n) => n.id)).toEqual(expect.arrayContaining(['stun', 'companion']));
    const hidden = explainIntent(content, def, { move: moveId, kind: 'attack', hidden: true });
    expect(hidden.title).toBe('Hidden');
    expect(hidden.notes).toEqual([]);
  });

  it('a status explanation carries its amount and its related terms', () => {
    const ex = explainStatus(content, 'chill', 3);
    expect(ex.title).toBe('Chill 3');
    expect(ex.notes.map((n) => n.id)).toEqual(['frozen']);
  });
});
