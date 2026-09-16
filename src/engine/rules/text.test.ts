import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import type { Amount, Effect } from '../../content/schema';
import { applyStatus, createCombat, describeCard, describeResolved, plainText, resolveCard } from './index';

const content = loadContent({ fixtures: true });

function amounts(effects: Effect[]): number[] {
  const out: number[] = [];
  const visit = (ef: Effect) => {
    const a = (ef as { amount?: Amount }).amount;
    if (typeof a === 'number' && a !== 0) out.push(Math.abs(a));
    else if (a && typeof a === 'object' && a.base !== 0) out.push(a.base);
    for (const key of ['then', 'else', 'effects'] as const) {
      const nested = (ef as Record<string, unknown>)[key];
      if (Array.isArray(nested)) nested.forEach((n) => visit(n as Effect));
    }
  };
  effects.forEach(visit);
  return out;
}

describe('card text', () => {
  it('renders every card, base and upgraded, and mentions every printed number', () => {
    for (const card of Object.values(content.cards)) {
      for (const upgraded of [false, true]) {
        const text = plainText(describeCard(card, upgraded));
        expect(text.length, `${card.id}${upgraded ? '+' : ''}`).toBeGreaterThan(0);
        expect(text, card.id).not.toContain('[');
        const resolved = resolveCard(card, upgraded);
        for (const n of amounts(resolved.effects)) expect(text, `${card.id}${upgraded ? '+' : ''} should mention ${n}`).toContain(String(n));
      }
    }
  });

  it('reads well for the common shapes', () => {
    const t = (id: string, up = false) => plainText(describeCard(content.cards[id]!, up));
    expect(t('strike')).toBe('Deal 6 damage.');
    expect(t('strike', true)).toBe('Deal 9 damage.');
    expect(t('bash')).toBe('Deal 8 damage. Apply 2 Vulnerable.');
    expect(t('cleave')).toBe('Deal 8 damage to ALL enemies.');
    expect(t('twin-strike')).toBe('Deal 5 damage 2 times.');
    expect(t('missiles')).toBe('Deal 3 damage to a random enemy 3 times.');
    expect(t('inflame')).toBe('Gain 2 Strength.');
    expect(t('test-verdict')).toBe('Spend all Holy Power: deal 5 damage, +4 per point.');
    expect(t('test-generator')).toBe('Deal 6 damage. +1 Holy Power.');
    expect(t('test-trap')).toBe('Armed: when an enemy attacks you, deal 8 damage to ALL enemies.');
    expect(t('test-power')).toBe('At the end of your turn, deal 3 damage to ALL enemies.');
    expect(t('test-conditional')).toBe('Deal 4 damage. If the target is Vulnerable, draw 1.');
    expect(t('test-exhaust')).toBe('Draw 2. Exhaust.');
    expect(t('test-exhaust', true)).toBe('Draw 2.');
    expect(t('second-look')).toBe('Draw 2. Discard a card.');
    expect(t('bandages')).toBe('Heal 4. Exhaust.');
    expect(t('doubt')).toBe('Unplayable. At the end of your turn, gain 1 Weak.');
    expect(t('torn-page')).toBe('Unplayable. Ethereal.');
  });

  it('shows live numbers with their printed base', () => {
    const s = createCombat(content, { classId: 'paladin', maxHp: 80, deck: [{ cardId: 'strike' }] }, { enemies: ['dummy-brute'] }, 'txt');
    const e = s.enemies[0]!;
    applyStatus(s, content, 'hero', 'strength', 3);
    applyStatus(s, content, e.id, 'vulnerable', 1);
    applyStatus(s, content, e.id, 'mark', 1);
    const segs = describeResolved(resolveCard(content.cards['strike']!, false), { state: s, targetId: e.id });
    const n = segs.find((x) => x.num)!;
    expect(n.num).toEqual({ value: Math.floor(9 * 1.5) + 3, base: 6 });
    expect(plainText(segs)).toBe('Deal 16 damage.');

    s.hero.resources.holyPower = 3;
    const v = plainText(describeResolved(resolveCard(content.cards['test-verdict']!, false), { state: s, targetId: e.id }));
    // (5 + 4×3) = 17, +3 Strength = 20, ×1.5 Vulnerable = 30, +3 Mark = 33
    expect(v).toBe('Spend all Holy Power: deal 33 damage.');
  });
});
