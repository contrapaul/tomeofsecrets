import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from '../../app/fit';
import { d, done } from './motion';
import { PALETTE } from './palette';
import { makeText, STYLE } from './text';

/** A line of guidance at the top of the stage that fades in, waits, fades out. */
export async function toast(layer: Container, text: string, seconds = 3.5, y = 100): Promise<void> {
  const c = new Container({ label: 'toast' });
  const t = makeText(text, { ...STYLE.body(26), fill: PALETTE.parchment, wordWrap: true, wordWrapWidth: 900, align: 'center' });
  t.anchor.set(0.5);
  const bg = new Graphics();
  bg.roundRect(-t.width / 2 - 28, -t.height / 2 - 14, t.width + 56, t.height + 28, 12).fill({ color: 0x000000, alpha: 0.75 }).stroke({ color: PALETTE.gold, width: 2 });
  c.addChild(bg, t);
  c.position.set(DESIGN.width / 2, y);
  c.alpha = 0;
  c.eventMode = 'none';
  layer.addChild(c);
  await done(gsap.to(c, { alpha: 1, duration: d(0.25) }));
  await new Promise((r) => setTimeout(r, seconds * 1000));
  await done(gsap.to(c, { alpha: 0, duration: d(0.3) }));
  c.destroy({ children: true });
}
