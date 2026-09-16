import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { FONT } from '../../app/fonts';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';

/** HP with a block shield hanging off its left end. */
export class HpBar extends Container {
  private readonly fill = new Graphics();
  private readonly chip = new Graphics();
  private readonly text = makeText('', { fontFamily: FONT.mono, fontSize: 15, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } });
  private readonly shield = new Container();
  private readonly shieldText = makeText('', { fontFamily: FONT.mono, fontSize: 15, fill: PALETTE.ink });
  private hp = 1;
  private max = 1;
  private shown = 1;

  constructor(private readonly barW: number, private readonly barH = 20) {
    super({ label: 'hp' });
    const bg = new Graphics();
    bg.roundRect(0, 0, barW, barH, barH / 2).fill(0x2a1116).stroke({ color: 0x000000, width: 2 });
    this.addChild(bg, this.chip, this.fill);
    this.text.anchor.set(0.5);
    this.text.position.set(barW / 2, barH / 2);
    this.addChild(this.text);

    const s = new Graphics();
    s.poly([0, -17, 16, -9, 16, 6, 0, 17, -16, 6, -16, -9]).fill(PALETTE.frost).stroke({ color: PALETTE.ink, width: 2 });
    this.shieldText.anchor.set(0.5);
    this.shield.addChild(s, this.shieldText);
    this.shield.position.set(-4, barH / 2);
    this.shield.visible = false;
    this.addChild(this.shield);
  }

  set(hp: number, max: number, block: number): void {
    this.hp = hp;
    this.max = max;
    this.text.text = `${hp} / ${max}`;
    const target = Math.max(0, hp / Math.max(1, max));
    // The red fill snaps, a pale chip drains after it: the classic "damage just happened" read.
    this.paint(this.fill, target, 0xc7364a, 0x7d1f2e);
    gsap.to(this, { shown: target, duration: d(0.5), ease: 'power2.out', onUpdate: () => this.paint(this.chip, this.shown, 0xf0d8a0, 0xd8b070), overwrite: true });
    this.setBlock(block);
  }

  setBlock(block: number): void {
    this.shield.visible = block > 0;
    this.shieldText.text = String(block);
    if (block > 0) gsap.fromTo(this.shield.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: d(0.2), ease: 'back.out(2)' });
  }

  private paint(g: Graphics, frac: number, top: number, bottom: number): void {
    g.clear();
    const w = Math.max(0, Math.round(this.barW * frac));
    if (w <= 0) return;
    g.roundRect(0, 0, w, this.barH, this.barH / 2).fill(bottom);
    g.roundRect(0, 0, w, this.barH / 2, this.barH / 4).fill({ color: top, alpha: 0.9 });
  }

  get value(): number {
    return this.hp;
  }

  get maximum(): number {
    return this.max;
  }
}
