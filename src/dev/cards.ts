import { Container } from 'pixi.js';
import { loadContent } from '../content';
import { describeResolved, resolveCard } from '../engine/rules';
import { DESIGN } from '../app/fit';
import type { Scene, SceneContext } from '../app/router';
import { CardView } from '../ui/cards/CardView';
import { HandLayout } from '../ui/cards/HandLayout';
import { backdrop } from '../ui/kit/backdrop';
import { Button } from '../ui/kit/button';
import { PALETTE } from '../ui/kit/palette';
import { makeText, STYLE } from '../ui/kit/text';

/**
 * #/dev/cards?class=neutral&up=1 — every card of a class in a grid, plus a
 * ten-card fan at the bottom to feel the hand. Hover lifts.
 */
export function devCardsScene(ctx: SceneContext): Scene {
  const view = new Container({ label: 'dev-cards' });
  const content = loadContent({ fixtures: true });
  return {
    view,
    enter(params) {
      view.addChild(backdrop());
      const cls = params.get('class') ?? 'neutral';
      const upgraded = params.get('up') === '1';
      const cards = Object.values(content.cards).filter((c) => cls === 'all' || c.class === cls);

      const title = makeText(`DEV · CARDS · ${cls}${upgraded ? ' (upgraded)' : ''} · ${cards.length}`, { ...STYLE.display(30), fill: PALETTE.gold });
      title.position.set(60, 30);
      view.addChild(title);

      let uid = 1;
      const make = (card: (typeof cards)[number]) => {
        const resolved = resolveCard(card, upgraded);
        const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
        return new CardView(uid++, card, { resolved, segments: describeResolved(resolved), cost });
      };

      // Grid, scaled to 0.62, eight per row.
      const grid = new Container();
      view.addChild(grid);
      const s = 0.62;
      cards.slice(0, 16).forEach((card, i) => {
        const cv = make(card);
        cv.scale.set(s);
        cv.position.set(60 + 125 + (i % 8) * 232, 100 + 115 + Math.floor(i / 8) * 232);
        grid.addChild(cv);
      });

      // A fan of ten.
      const hand = new HandLayout({ centerX: DESIGN.width / 2, baseY: 950, scale: 0.8, hoverScale: 1.15, maxSpread: 1100 });
      view.addChild(hand);
      const pool = cards.length ? cards : Object.values(content.cards);
      for (let i = 0; i < 10; i++) {
        const cv = make(pool[i % pool.length]!);
        cv.on('pointerover', () => hand.setHover(cv));
        cv.on('pointerout', () => {
          if (hand.hovered === cv) hand.setHover(null);
        });
        hand.add(cv);
      }
      hand.layout(true);

      const nav = new Container();
      view.addChild(nav);
      ['all', 'neutral', 'paladin', 'tracker', 'mage', 'curse', 'status'].forEach((c, i) => {
        const b = new Button({ label: c, width: 150, height: 44, variant: c === cls ? 'gold' : 'ghost', onPress: () => ctx.router.go('/dev/cards', { class: c, up: upgraded ? '1' : '0' }) });
        b.position.set(DESIGN.width - 90 - (6 - i) * 160, 52);
        nav.addChild(b);
      });
      const up = new Button({ label: upgraded ? 'Upgraded' : 'Base', width: 150, height: 44, variant: 'ghost', onPress: () => ctx.router.go('/dev/cards', { class: cls, up: upgraded ? '0' : '1' }) });
      up.position.set(DESIGN.width - 90, 110);
      nav.addChild(up);
    },
    exit() {},
  };
}
