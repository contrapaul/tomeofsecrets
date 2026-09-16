import { Container, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { PALETTE } from './palette';
import { makeText, STYLE } from './text';

export interface ButtonOptions {
  label: string;
  width?: number;
  height?: number;
  onPress?: () => void;
  disabled?: boolean;
  /** Small tag drawn after the label, e.g. "soon". */
  tag?: string;
  variant?: 'gold' | 'ghost';
}

/** A parchment-and-gold button. Hover lifts, press dips, disabled greys. */
export class Button extends Container {
  private readonly bg = new Graphics();
  private readonly w: number;
  private readonly h: number;
  private readonly variant: 'gold' | 'ghost';
  private disabled: boolean;

  constructor(opts: ButtonOptions) {
    super({ label: `button:${opts.label}` });
    this.w = opts.width ?? 360;
    this.h = opts.height ?? 72;
    this.variant = opts.variant ?? 'gold';
    this.disabled = opts.disabled ?? false;
    this.addChild(this.bg);
    this.paint(0);

    const label = makeText(opts.label, { ...STYLE.display(30), fill: this.variant === 'gold' ? PALETTE.ink : PALETTE.parchment });
    label.anchor.set(0.5);
    label.position.set(this.w / 2, this.h / 2 + 2);
    this.addChild(label);

    if (opts.tag) {
      const tag = makeText(opts.tag, { ...STYLE.mono(16), fill: this.variant === 'gold' ? PALETTE.ink : PALETTE.parchmentDim });
      tag.anchor.set(1, 0.5);
      tag.alpha = 0.7;
      tag.position.set(this.w - 16, this.h / 2 + 2);
      this.addChild(tag);
    }

    this.eventMode = this.disabled ? 'none' : 'static';
    this.cursor = 'pointer';
    this.alpha = this.disabled ? 0.45 : 1;
    this.pivot.set(this.w / 2, this.h / 2);

    this.on('pointerover', () => this.hover(true));
    this.on('pointerout', () => this.hover(false));
    this.on('pointerdown', () => gsap.to(this.scale, { x: 0.97, y: 0.97, duration: 0.06 }));
    this.on('pointerup', () => gsap.to(this.scale, { x: 1.03, y: 1.03, duration: 0.1 }));
    this.on('pointerupoutside', () => this.hover(false));
    this.on('pointertap', () => opts.onPress?.());
  }

  private hover(on: boolean): void {
    gsap.to(this.scale, { x: on ? 1.03 : 1, y: on ? 1.03 : 1, duration: 0.12, ease: 'power2.out' });
    this.paint(on ? 1 : 0);
  }

  private paint(hover: number): void {
    const g = this.bg;
    g.clear();
    if (this.variant === 'gold') {
      g.roundRect(0, 0, this.w, this.h, 10).fill(hover ? PALETTE.goldBright : PALETTE.gold);
      g.roundRect(3, 3, this.w - 6, this.h - 6, 8).stroke({ color: PALETTE.ink, width: 2, alpha: 0.35 });
    } else {
      g.roundRect(0, 0, this.w, this.h, 10).fill({ color: PALETTE.parchment, alpha: hover ? 0.12 : 0.06 });
      g.roundRect(0, 0, this.w, this.h, 10).stroke({ color: PALETTE.gold, width: 2, alpha: hover ? 1 : 0.6 });
    }
  }
}
