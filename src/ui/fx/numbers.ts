import type { Container } from 'pixi.js';
import gsap from 'gsap';
import { FONT } from '../../app/fonts';
import { d, done } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';

export type NumberKind = 'damage' | 'blocked' | 'heal' | 'block' | 'negated' | 'status';

const COLORS: Record<NumberKind, number> = {
  damage: 0xffe0e0, blocked: 0xb9c7d6, heal: 0x9fe09f, block: PALETTE.frost, negated: PALETTE.parchmentDim, status: PALETTE.goldBright,
};

/** A number that pops, rises and fades at a stage position. */
export function floatNumber(layer: Container, x: number, y: number, text: string, kind: NumberKind, big = false): Promise<void> {
  const t = makeText(text, {
    fontFamily: FONT.display,
    fontWeight: '900',
    fontSize: big ? 56 : 40,
    fill: COLORS[kind],
    stroke: { color: 0x000000, width: 6 },
  });
  t.anchor.set(0.5);
  t.position.set(x + (Math.random() - 0.5) * 30, y);
  t.scale.set(0.4);
  layer.addChild(t);
  const tl = gsap.timeline({ onComplete: () => t.destroy() });
  tl.to(t.scale, { x: 1, y: 1, duration: d(0.16), ease: 'back.out(3)' }, 0)
    .to(t, { y: y - 70, duration: d(0.7), ease: 'power1.out' }, 0)
    .to(t, { alpha: 0, duration: d(0.3) }, d(0.45));
  return done(tl);
}

/** Shake a container in place. */
export function shake(target: Container, px: number, times = 3): Promise<void> {
  const x0 = target.x;
  const y0 = target.y;
  const tl = gsap.timeline({ onComplete: () => target.position.set(x0, y0) });
  for (let i = 0; i < times; i++) {
    const s = px * (1 - i / times);
    tl.to(target, { x: x0 + (i % 2 ? -s : s), y: y0 + (Math.random() - 0.5) * s, duration: d(0.04) });
  }
  tl.to(target, { x: x0, y: y0, duration: d(0.04) });
  return done(tl);
}
