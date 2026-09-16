import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { StatusId } from '../../content/schema';
import { FONT } from '../../app/fonts';
import { STATUS_INFO } from '../kit/glossary';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';
import { isDebuff } from '../../engine/rules';

/** A row of status icons with counts; hover shows the glossary entry. */
export class StatusRow extends Container {
  private readonly icons = new Map<StatusId, Container>();

  constructor(private readonly tooltip: Tooltip, private readonly align: 'left' | 'center' = 'center') {
    super({ label: 'statuses' });
  }

  set(status: StatusId, total: number): void {
    let icon = this.icons.get(status);
    if (total <= 0) {
      if (icon) {
        this.icons.delete(status);
        gsap.to(icon, { alpha: 0, duration: d(0.15), onComplete: () => icon!.destroy({ children: true }) });
        this.reflow();
      }
      return;
    }
    if (!icon) {
      icon = this.makeIcon(status);
      this.icons.set(status, icon);
      this.addChild(icon);
      icon.alpha = 0;
      gsap.to(icon, { alpha: 1, duration: d(0.15) });
      this.reflow();
    }
    const label = icon.getChildByLabel('count') as ReturnType<typeof makeText>;
    label.text = String(total);
    gsap.fromTo(icon.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: d(0.2), ease: 'back.out(2)' });
  }

  private makeIcon(status: StatusId): Container {
    const c = new Container({ label: `status:${status}` });
    const debuff = isDebuff(status);
    const g = new Graphics();
    g.circle(0, 0, 15).fill(debuff ? 0x4a2a5a : 0x2b3d2e).stroke({ color: debuff ? 0xb08ad0 : 0x8fd18f, width: 2 });
    c.addChild(g);
    const letter = makeText(STATUS_INFO[status].name.slice(0, 2), { fontFamily: FONT.display, fontWeight: '700', fontSize: 12, fill: PALETTE.parchment });
    letter.anchor.set(0.5);
    c.addChild(letter);
    const count = makeText('0', { fontFamily: FONT.mono, fontSize: 14, fill: PALETTE.parchment, stroke: { color: PALETTE.ink, width: 3 } });
    count.label = 'count';
    count.anchor.set(0.5);
    count.position.set(13, 11);
    c.addChild(count);
    c.eventMode = 'static';
    c.on('pointerover', () => {
      const p = c.getGlobalPosition();
      const local = this.tooltip.parent!.toLocal(p);
      this.tooltip.show(`${STATUS_INFO[status].name} ${count.text}`, STATUS_INFO[status].text, local.x, local.y);
    });
    c.on('pointerout', () => this.tooltip.hide());
    return c;
  }

  private reflow(): void {
    const items = [...this.icons.values()];
    const gap = 36;
    const start = this.align === 'center' ? -((items.length - 1) * gap) / 2 : 0;
    items.forEach((icon, i) => gsap.to(icon, { x: start + i * gap, y: 0, duration: d(0.15) }));
  }
}
