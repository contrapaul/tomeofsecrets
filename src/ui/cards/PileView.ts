import { Container, Graphics } from 'pixi.js';
import { FONT } from '../../app/fonts';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';

/** A stack of card backs with a count: the draw, discard and exhaust piles. */
export class PileView extends Container {
  private readonly count = makeText('0', { fontFamily: FONT.mono, fontSize: 26, fill: PALETTE.parchment });
  private readonly stack = new Graphics();

  constructor(labelText: string, private readonly edge: number) {
    super({ label: `pile:${labelText}` });
    this.paint(0);
    this.addChild(this.stack);
    const label = makeText(labelText.toUpperCase(), { fontFamily: FONT.mono, fontSize: 12, letterSpacing: 1.5, fill: PALETTE.parchmentDim });
    label.anchor.set(0.5, 0);
    label.position.set(0, 56);
    this.count.anchor.set(0.5);
    this.count.position.set(0, 0);
    this.addChild(label, this.count);
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  setCount(n: number): void {
    this.count.text = String(n);
    this.paint(n);
  }

  private paint(n: number): void {
    const g = this.stack;
    g.clear();
    const layers = Math.min(4, Math.max(1, Math.ceil(n / 5)));
    for (let i = layers - 1; i >= 0; i--) {
      const o = i * 3;
      g.roundRect(-36 - o, -50 - o, 72, 100, 8).fill(PALETTE.inkLight).stroke({ color: this.edge, width: 2, alpha: 0.9 });
    }
    g.roundRect(-30, -44, 60, 88, 6).stroke({ color: this.edge, width: 1, alpha: 0.4 });
    if (n === 0) g.roundRect(-36, -50, 72, 100, 8).fill({ color: 0x000000, alpha: 0.4 });
  }
}
