import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { DESIGN } from '../../app/fit';
import { PALETTE } from './palette';
import { makeText, STYLE } from './text';
import { d } from './motion';

/**
 * One tooltip for the whole stage, shown on hover with a title and body.
 * Lives in `stage.overlay` so it draws above everything.
 */
export class Tooltip extends Container {
  private readonly bg = new Graphics();
  private readonly title = makeText('', { ...STYLE.display(18), fill: PALETTE.gold });
  private readonly body = makeText('', { ...STYLE.body(20), wordWrap: true, wordWrapWidth: 300 });
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super({ label: 'tooltip' });
    this.addChild(this.bg, this.title, this.body);
    this.title.position.set(14, 10);
    this.body.position.set(14, 38);
    this.visible = false;
    this.alpha = 0;
    this.eventMode = 'none';
  }

  /** Show near a stage point after a short delay; the box stays inside the frame. */
  show(title: string, body: string, x: number, y: number, delayMs = 250): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.title.text = title;
      this.body.text = body;
      this.body.position.set(14, title ? 38 : 10);
      const w = Math.max(this.title.width, this.body.width) + 28;
      const h = this.body.position.y + this.body.height + 12;
      this.bg.clear();
      this.bg.roundRect(0, 0, w, h, 8).fill({ color: 0x14121c, alpha: 0.96 }).stroke({ color: PALETTE.gold, width: 1.5 });
      this.position.set(Math.min(x + 16, DESIGN.width - w - 8), Math.min(Math.max(8, y - h / 2), DESIGN.height - h - 8));
      this.visible = true;
      gsap.to(this, { alpha: 1, duration: d(0.12), overwrite: true });
    }, delayMs);
  }

  hide(): void {
    clearTimeout(this.timer);
    gsap.to(this, { alpha: 0, duration: d(0.1), overwrite: true, onComplete: () => (this.visible = false) });
  }
}
