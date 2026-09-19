import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { ContentRegistry } from '../../content';
import { describeResolved, resolveCard } from '../../engine/rules';
import { CardView } from '../cards/CardView';
import { FONT } from '../../app/fonts';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText, STYLE } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';
import type { Explainer } from '../kit/explainer';

/** A card for a reward or shop row: hover lifts, click chooses. */
export function offerCard(content: ContentRegistry, cardId: string, uid: number, scale: number, onPick: () => void, explainer?: Explainer): CardView | null {
  const def = content.cards[cardId];
  if (!def) return null;
  const resolved = resolveCard(def, false);
  const cost = resolved.cost === 'X' ? ('X' as const) : { value: resolved.cost, base: resolved.cost };
  const cv = new CardView(uid, def, { resolved, segments: describeResolved(resolved), cost });
  cv.scale.set(scale);
  cv.cursor = 'pointer';
  cv.on('pointerover', () => gsap.to(cv.scale, { x: scale * 1.08, y: scale * 1.08, duration: d(0.12) }));
  cv.on('pointerout', () => gsap.to(cv.scale, { x: scale, y: scale, duration: d(0.12) }));
  const hint = explainer?.attach(cv, () => explainer.forCard(resolved), { header: false });
  cv.on('pointertap', (e) => {
    // On touch the first tap explains the card; the second takes it.
    if (hint && e.pointerType === 'touch' && !hint.explainedByTouch()) return;
    onPick();
  });
  return cv;
}

/** A relic as a round token with its name; hover explains it. */
export function relicToken(content: ContentRegistry, id: string, tooltip: Tooltip, onPick?: () => void, explainer?: Explainer): Container {
  const relic = content.relics[id];
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, 44).fill({ color: 0x2a2210 }).stroke({ color: PALETTE.gold, width: 3 });
  c.addChild(g);
  const letter = makeText(relic?.name[0] ?? '?', { fontFamily: FONT.display, fontWeight: '900', fontSize: 40, fill: PALETTE.goldBright });
  letter.anchor.set(0.5);
  c.addChild(letter);
  const name = makeText(relic?.name ?? id, { ...STYLE.display(20), fill: PALETTE.parchment });
  name.anchor.set(0.5, 0);
  name.position.set(0, 56);
  c.addChild(name);
  c.eventMode = 'static';
  const hint = explainer && relic ? explainer.attach(c, () => explainer.forRelic(relic)) : null;
  c.on('pointerover', () => {
    if (!hint) {
      const p = tooltip.parent!.toLocal(c.getGlobalPosition());
      tooltip.show(relic?.name ?? id, relic?.text ?? '', p.x + 50, p.y);
    }
    if (onPick) gsap.to(c.scale, { x: 1.08, y: 1.08, duration: d(0.12) });
  });
  c.on('pointerout', () => {
    tooltip.hide();
    gsap.to(c.scale, { x: 1, y: 1, duration: d(0.12) });
  });
  if (onPick) {
    c.cursor = 'pointer';
    c.on('pointertap', (e) => {
      if (hint && e.pointerType === 'touch' && !hint.explainedByTouch()) return;
      onPick();
    });
  }
  return c;
}

/** A vial as a small flask token. */
export function vialToken(content: ContentRegistry, id: string, tooltip: Tooltip, onPick?: () => void, explainer?: Explainer): Container {
  const vial = content.vials[id];
  const c = new Container();
  const g = new Graphics();
  g.roundRect(-26, -34, 52, 68, 14).fill({ color: 0x2b3d4e }).stroke({ color: PALETTE.frost, width: 3 });
  c.addChild(g);
  const letter = makeText(vial?.name[0] ?? '?', { fontFamily: FONT.display, fontWeight: '900', fontSize: 30, fill: PALETTE.parchment });
  letter.anchor.set(0.5);
  c.addChild(letter);
  const name = makeText(vial?.name ?? id, { ...STYLE.display(18), fill: PALETTE.parchment });
  name.anchor.set(0.5, 0);
  name.position.set(0, 44);
  c.addChild(name);
  c.eventMode = 'static';
  const hint = explainer && vial ? explainer.attach(c, () => explainer.forVial(vial)) : null;
  if (!hint) {
    c.on('pointerover', () => {
      const p = tooltip.parent!.toLocal(c.getGlobalPosition());
      tooltip.show(vial?.name ?? id, vial?.text ?? '', p.x + 40, p.y);
    });
    c.on('pointerout', () => tooltip.hide());
  }
  if (onPick) {
    c.cursor = 'pointer';
    c.on('pointertap', (e) => {
      if (hint && e.pointerType === 'touch' && !hint.explainedByTouch()) return;
      onPick();
    });
  }
  return c;
}

export function heading(text: string, y: number, sub?: string): Container {
  const c = new Container();
  const t = makeText(text.toUpperCase(), { ...STYLE.display(44), fill: PALETTE.gold, letterSpacing: 5 });
  t.anchor.set(0.5, 0);
  c.addChild(t);
  if (sub) {
    const s = makeText(sub, { ...STYLE.body(24), fontStyle: 'italic', fill: PALETTE.parchmentDim });
    s.anchor.set(0.5, 0);
    s.position.set(0, 56);
    c.addChild(s);
  }
  c.position.set(960, y);
  return c;
}
