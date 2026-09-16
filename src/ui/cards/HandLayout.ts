import { Container } from 'pixi.js';
import gsap from 'gsap';
import { d } from '../kit/motion';
import { CARD_H, CARD_W, type CardView } from './CardView';

export interface Slot {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export interface HandOptions {
  centerX: number;
  /** Where the card centres sit at the middle of the fan. */
  baseY: number;
  scale: number;
  hoverScale: number;
  /** Widest the fan may spread, edge to edge of card centres. */
  maxSpread: number;
}

/**
 * Cards on an arc. Every card has a slot; `layout()` tweens each to its slot.
 * The hovered card lifts, straightens and grows; its neighbours part. A card
 * being dragged is left alone.
 */
export class HandLayout extends Container {
  readonly cards: CardView[] = [];
  hovered: CardView | null = null;
  dragging: CardView | null = null;
  /** While a drag hovers the hand band, the index the card would be inserted at. */
  insertAt: number | null = null;

  constructor(private readonly opts: HandOptions) {
    super({ label: 'hand' });
    this.sortableChildren = true;
  }

  add(view: CardView, at?: number): void {
    if (at === undefined || at >= this.cards.length) this.cards.push(view);
    else this.cards.splice(at, 0, view);
    this.addChild(view);
  }

  remove(view: CardView): void {
    const i = this.cards.indexOf(view);
    if (i >= 0) this.cards.splice(i, 1);
    if (view.parent === this) this.removeChild(view);
    if (this.hovered === view) this.hovered = null;
    if (this.dragging === view) this.dragging = null;
  }

  find(cardUid: number): CardView | undefined {
    return this.cards.find((c) => c.cardUid === cardUid);
  }

  /** The order of instance ids, for writing back to the engine after a rearrange. */
  order(): number[] {
    return this.cards.map((c) => c.cardUid);
  }

  /** Slot for index `i` of `n` cards, before hover adjustments. */
  slotFor(i: number, n: number): Slot {
    const { centerX, baseY, scale, maxSpread } = this.opts;
    const spacing = n <= 1 ? 0 : Math.min(CARD_W * scale * 0.62, maxSpread / (n - 1));
    const offset = (i - (n - 1) / 2) * spacing;
    const t = n <= 1 ? 0 : offset / (maxSpread / 2);
    const maxAngle = Math.min(0.26, 0.06 * (n - 1));
    return {
      x: centerX + offset,
      y: baseY + t * t * 46,
      rotation: t * maxAngle,
      scale,
    };
  }

  /** Move every card to its slot, animated unless `instant`. */
  layout(instant = false): void {
    const laid = this.cards.filter((c) => c !== this.dragging);
    const n = laid.length + (this.insertAt !== null && this.dragging ? 1 : 0);
    const hoverIndex = this.hovered ? laid.indexOf(this.hovered) : -1;
    let slotIndex = 0;
    laid.forEach((card, i) => {
      if (this.insertAt !== null && this.dragging && slotIndex === this.insertAt) slotIndex++;
      const slot = this.slotFor(slotIndex, n);
      slotIndex++;
      let { x, y, rotation, scale } = slot;
      let z = i;
      if (hoverIndex >= 0) {
        if (i === hoverIndex) {
          y -= CARD_H * this.opts.hoverScale * 0.36;
          rotation = 0;
          scale = this.opts.hoverScale;
          z = 100;
        } else {
          x += i < hoverIndex ? -34 : 34;
        }
      }
      card.zIndex = z;
      const dur = instant ? 0 : d(0.22);
      gsap.to(card, { x, y, rotation, duration: dur, ease: 'back.out(1.2)', overwrite: 'auto' });
      gsap.to(card.scale, { x: scale, y: scale, duration: dur, ease: 'power2.out', overwrite: 'auto' });
    });
  }

  setHover(view: CardView | null): void {
    if (this.hovered === view) return;
    this.hovered = view;
    this.layout();
  }

  /** Where in the fan a pointer x would insert a dragged card. */
  indexForX(x: number): number {
    const laid = this.cards.filter((c) => c !== this.dragging);
    const n = laid.length + 1;
    let best = n - 1;
    for (let i = 0; i < n; i++) {
      if (x < this.slotFor(i, n).x + 0) {
        best = i;
        break;
      }
    }
    return best;
  }

  /** The band in which a dragged card counts as "still in the hand". */
  get bandTop(): number {
    return this.opts.baseY - CARD_H * this.opts.scale * 0.75;
  }
}
