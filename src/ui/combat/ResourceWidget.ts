import { Container, FillGradient, Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { ResourceName } from '../../content/schema';
import { FONT } from '../../app/fonts';
import { d } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { makeText } from '../kit/text';
import type { Tooltip } from '../kit/tooltip';

const INFO: Record<ResourceName, { name: string; text: string; cap: number }> = {
  holyPower: { name: 'Holy Power', text: 'Built by generators, spent by verdicts. Holds up to 5 and stays between turns.', cap: 5 },
  charge: { name: 'Arcane Charges', text: 'Gained by Arcane cards. Some spells hit harder per Charge; Barrage spends them all. Holds up to 4.', cap: 4 },
};

/** Holy Power pips or Arcane Charge gems, under the hero's statuses. */
export class ResourceWidget extends Container {
  private readonly slots: Graphics[] = [];
  private value = 0;

  constructor(readonly resource: ResourceName, tooltip: Tooltip) {
    super({ label: `resource:${resource}` });
    const info = INFO[resource];
    const gap = resource === 'holyPower' ? 30 : 36;
    for (let i = 0; i < info.cap; i++) {
      const g = new Graphics();
      g.position.set((i - (info.cap - 1) / 2) * gap, 0);
      this.slots.push(g);
      this.addChild(g);
    }
    const label = makeText(info.name.toUpperCase(), { fontFamily: FONT.mono, fontSize: 11, letterSpacing: 1.5, fill: PALETTE.parchmentDim });
    label.anchor.set(0.5, 0);
    label.position.set(0, 20);
    this.addChild(label);
    this.eventMode = 'static';
    this.on('pointerover', () => {
      const p = tooltip.parent!.toLocal(this.getGlobalPosition());
      tooltip.show(`${info.name} ${this.value}`, info.text, p.x, p.y);
    });
    this.on('pointerout', () => tooltip.hide());
    this.paint();
  }

  set(total: number): void {
    const grew = total > this.value;
    this.value = total;
    this.paint();
    if (grew) {
      const g = this.slots[total - 1];
      if (g) gsap.fromTo(g.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: d(0.3), ease: 'back.out(2)' });
    } else {
      for (const g of this.slots) gsap.fromTo(g.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: d(0.25), ease: 'back.out(2)' });
    }
  }

  private paint(): void {
    this.slots.forEach((g, i) => {
      const on = i < this.value;
      g.clear();
      if (this.resource === 'holyPower') {
        if (on) {
          g.circle(0, 0, 11).fill(new FillGradient({ type: 'radial', center: { x: 0.35, y: 0.3 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.6, colorStops: [{ offset: 0, color: 0xfff1b8 }, { offset: 0.5, color: PALETTE.gold }, { offset: 1, color: 0x7a5a14 }] }));
          g.circle(0, 0, 14).stroke({ color: PALETTE.goldBright, width: 2, alpha: 0.5 });
        } else {
          g.circle(0, 0, 11).fill(0x2a2210).stroke({ color: 0x5a4718, width: 2 });
        }
      } else {
        g.rect(-11, -11, 22, 22).fill(on ? PALETTE.arcane : 0x211a33).stroke({ color: on ? 0xe6dcff : 0x4a3d73, width: 2 });
        g.rotation = Math.PI / 4;
        if (on) g.rect(-11, -11, 22, 22).stroke({ color: 0xe6dcff, width: 6, alpha: 0.25 });
      }
    });
  }
}
