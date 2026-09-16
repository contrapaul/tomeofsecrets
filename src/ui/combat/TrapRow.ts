import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { Content } from '../../engine/rules';
import { icon } from '../kit/icons';
import { d, done } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import type { Tooltip } from '../kit/tooltip';

/** Armed traps under the hero: a jaw icon per trap, with the card's name on hover. */
export class TrapRow extends Container {
  private readonly traps = new Map<number, Container>();

  constructor(private readonly content: Content, private readonly tooltip: Tooltip) {
    super({ label: 'traps' });
  }

  arm(uid: number, cardId: string): void {
    const c = new Container();
    const g = new Graphics();
    g.circle(0, 0, 20).fill({ color: 0x2b3d2e, alpha: 0.95 }).stroke({ color: PALETTE.class.tracker, width: 2 });
    c.addChild(g, icon('trap', PALETTE.parchment, 24));
    c.eventMode = 'static';
    c.on('pointerover', () => {
      const p = this.tooltip.parent!.toLocal(c.getGlobalPosition());
      const name = this.content.cards[cardId]?.name ?? 'Trap';
      this.tooltip.show(name, 'Armed. Fires once on its trigger.', p.x, p.y);
    });
    c.on('pointerout', () => this.tooltip.hide());
    this.traps.set(uid, c);
    this.addChild(c);
    c.scale.set(0);
    gsap.to(c.scale, { x: 1, y: 1, duration: d(0.25), ease: 'back.out(2)' });
    this.reflow();
  }

  async fire(uid: number): Promise<void> {
    const c = this.traps.get(uid);
    if (!c) return;
    this.traps.delete(uid);
    await done(gsap.to(c.scale, { x: 1.8, y: 1.8, duration: d(0.15), ease: 'power2.out' }));
    await done(gsap.to(c, { alpha: 0, duration: d(0.1) }));
    c.destroy({ children: true });
    this.reflow();
  }

  remove(uid: number): void {
    const c = this.traps.get(uid);
    if (!c) return;
    this.traps.delete(uid);
    gsap.to(c, { alpha: 0, duration: d(0.15), onComplete: () => c.destroy({ children: true }) });
    this.reflow();
  }

  private reflow(): void {
    const items = [...this.traps.values()];
    items.forEach((c, i) => gsap.to(c, { x: (i - (items.length - 1) / 2) * 48, duration: d(0.15) }));
  }
}
