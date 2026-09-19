import type { Container} from 'pixi.js';
import { Graphics, type FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import type { Stage } from '../../app/stage';
import { d, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { CARD_H, CARD_W, type CardView } from './CardView';
import type { HandLayout } from './HandLayout';

export interface DragHost {
  hand: HandLayout;
  /** Layer the dragged card lives in, above the hand and the table. */
  floating: Container;
  /** Arrow and hints draw here. */
  fx: Container;
  stage: Stage;
  canInteract(): boolean;
  isTargeted(cardUid: number): boolean;
  /** The enemy instance id under a stage point, if any. */
  enemyAt(x: number, y: number): string | null;
  /** The middle of a living enemy's body: where the aim arrow lands. */
  enemyCenter(id: string): { x: number; y: number } | null;
  highlightEnemy(id: string | null): void;
  /** Where a targeted card parks while you aim it. */
  aimSpot: { x: number; y: number };
  /** Cards released above this line (stage y) are played. */
  playLineY: number;
  /** Attempt the play; false means the card comes back. */
  onPlay(cardUid: number, targetId?: string): boolean;
  onInspect(cardUid: number): void;
  onReorder(order: number[]): void;
}

/**
 * Pointer handling for cards in the hand: hover, click-to-inspect, drag with
 * lag and tilt, rearrange within the hand band, aim at an enemy or lift above
 * the play line to play, spring back otherwise.
 *
 * A targeted card, once lifted out of the hand, parks in the aim spot and an
 * arrow runs from it to the pointer; over an enemy the arrow locks into the
 * enemy's centre. Dragging back into the hand band unparks it.
 *
 * Hover is decided from the pointer's position against the fan's resting
 * slots, not from which card is under the pointer: lifting a card moves the
 * cards, and deciding by their moving edges flickers. A hovered card keeps its
 * hover while the pointer is anywhere over its lifted body. Touch never hovers;
 * a tap inspects.
 */
export class DragController {
  private pressed: CardView | null = null;
  private dragging: CardView | null = null;
  private aiming = false;
  private pressAt = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  private velocity = 0;
  private lastX = 0;
  private originalIndex = 0;
  private readonly arrow = new Graphics();
  private readonly playHint = new Graphics();
  private tick: (() => void) | null = null;

  constructor(private readonly host: DragHost) {
    host.fx.addChild(this.arrow, this.playHint);
    this.playHint.alpha = 0;
    const root = host.stage.app.stage;
    root.eventMode = 'static';
    root.hitArea = host.stage.app.screen;
    root.on('pointermove', (e) => this.onMove(e));
    root.on('pointerup', (e) => this.onUp(e));
    root.on('pointerupoutside', (e) => this.onUp(e));
  }

  attach(view: CardView): void {
    view.cursor = 'grab';
    view.on('pointerdown', (e) => {
      if (!this.host.canInteract()) return;
      this.pressed = view;
      const p = this.host.stage.root.toLocal(e.global);
      this.pressAt = { x: p.x, y: p.y };
      this.pointer = { x: p.x, y: p.y };
      this.lastX = p.x;
    });
  }

  private startDrag(view: CardView): void {
    const hand = this.host.hand;
    this.dragging = view;
    this.originalIndex = hand.cards.indexOf(view);
    hand.setHover(null);
    hand.dragging = view;
    // Carry the card into the floating layer at the same on-screen spot.
    const global = view.getGlobalPosition();
    hand.remove(view);
    hand.dragging = view;
    this.host.floating.addChild(view);
    const local = this.host.floating.toLocal(global);
    view.position.set(local.x, local.y);
    gsap.killTweensOf(view);
    gsap.killTweensOf(view.scale);
    gsap.to(view.scale, { x: 0.95, y: 0.95, duration: d(0.12) });
    view.setShadow(0.8);
    view.cursor = 'grabbing';
    hand.layout();

    this.tick = () => {
      if (this.aiming) {
        // Parked: the arrow follows the pointer, the card stays put.
        this.paintAim(view);
        return;
      }
      const target = this.pointer;
      // Lag gives weight; the rotation follows horizontal velocity.
      view.x += (target.x - view.x) * 0.38;
      view.y += (target.y - view.y) * 0.38;
      const vx = view.x - this.lastX;
      this.lastX = view.x;
      this.velocity = this.velocity * 0.8 + vx * 0.2;
      view.rotation += (Math.max(-0.22, Math.min(0.22, this.velocity * 0.02)) - view.rotation) * 0.3;
      this.paintAim(view);
    };
    this.host.stage.app.ticker.add(this.tick);
  }

  private paintAim(view: CardView): void {
    const hand = this.host.hand;
    const p = this.pointer;
    const inBand = p.y > hand.bandTop;
    this.arrow.clear();
    if (inBand) {
      if (this.aiming) this.unpark(view);
      hand.insertAt = hand.indexForX(p.x);
      hand.layout();
      this.host.highlightEnemy(null);
      this.setHint(false);
      return;
    }
    if (hand.insertAt !== null) {
      hand.insertAt = null;
      hand.layout();
    }
    if (this.host.isTargeted(view.cardUid)) {
      if (!this.aiming) this.park(view);
      const enemyId = this.host.enemyAt(p.x, p.y);
      this.host.highlightEnemy(enemyId);
      this.setHint(false);
      const end = (enemyId && this.host.enemyCenter(enemyId)) || p;
      this.drawArrow(view.x, view.y - (CARD_H * view.scale.y) / 2, end.x, end.y, !!enemyId);
    } else {
      this.host.highlightEnemy(null);
      this.setHint(p.y < this.host.playLineY);
    }
  }

  /** Lift the card into the aim spot; the pointer is free to go find a target. */
  private park(view: CardView): void {
    this.aiming = true;
    const spot = this.host.aimSpot;
    gsap.to(view, { x: spot.x, y: spot.y, rotation: 0, duration: d(0.16), ease: 'power2.out', overwrite: 'auto' });
    gsap.to(view.scale, { x: 1, y: 1, duration: d(0.16), ease: 'power2.out', overwrite: 'auto' });
  }

  /** Back under the pointer; the lag tween carries it there. */
  private unpark(view: CardView): void {
    this.aiming = false;
    gsap.killTweensOf(view);
    gsap.killTweensOf(view.scale);
    gsap.to(view.scale, { x: 0.95, y: 0.95, duration: d(0.12) });
    this.lastX = view.x;
    this.velocity = 0;
  }

  /**
   * The aim arrow: leaves the card straight up, bends toward the target and
   * arrives pointing into it. Locked on an enemy it is bright and lands in a
   * pulsing bullseye; otherwise it trails the pointer, dimmer.
   */
  private drawArrow(x0: number, y0: number, x1: number, y1: number, locked: boolean): void {
    const g = this.arrow;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist < 30) return;
    const cx = x0;
    const cy = y0 - Math.max(80, dist * 0.45);
    const color = locked ? PALETTE.goldBright : PALETTE.parchmentDim;
    const alpha = locked ? 1 : 0.6;
    // Tangent at the end: from the control point into the target.
    const ang = Math.atan2(y1 - cy, x1 - cx);
    const head = locked ? 30 : 24;
    const baseX = x1 - Math.cos(ang) * head * 0.7;
    const baseY = y1 - Math.sin(ang) * head * 0.7;
    g.moveTo(x0, y0).quadraticCurveTo(cx, cy, baseX, baseY).stroke({ color, width: 16, alpha: 0.16 * alpha, cap: 'round' });
    g.moveTo(x0, y0).quadraticCurveTo(cx, cy, baseX, baseY).stroke({ color, width: 6, alpha: 0.95 * alpha, cap: 'round' });
    g.poly([
      x1, y1,
      x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45),
      x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45),
    ]).fill({ color, alpha });
    if (locked) {
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 110);
      g.circle(x1, y1, 30 * pulse).stroke({ color, width: 3, alpha: 0.9 });
      g.circle(x1, y1, 46 * pulse).stroke({ color, width: 2, alpha: 0.35 });
    }
  }

  private setHint(on: boolean): void {
    if (on && this.playHint.alpha === 0) {
      this.playHint.clear();
      this.playHint.roundRect(560, this.host.playLineY - 4, 800, 8, 4).fill({ color: PALETTE.goldBright, alpha: 0.7 });
    }
    gsap.to(this.playHint, { alpha: on ? 1 : 0, duration: d(0.12), overwrite: true });
  }

  private onMove(e: FederatedPointerEvent): void {
    const p = this.host.stage.root.toLocal(e.global);
    this.pointer = { x: p.x, y: p.y };
    if (this.pressed && !this.dragging) {
      const dist = Math.hypot(p.x - this.pressAt.x, p.y - this.pressAt.y);
      if (dist > 8) this.startDrag(this.pressed);
    }
    // Aim on the pointer event itself, not only in the ticker, so a drop is
    // judged on where the pointer is even if frames are scarce.
    if (this.dragging) this.paintAim(this.dragging);
    else if (e.pointerType !== 'touch') this.updateHover(p, e);
  }

  /** Which card the pointer means, from the resting fan; sticky while over the lifted card. */
  private updateHover(p: { x: number; y: number }, e: FederatedPointerEvent): void {
    const hand = this.host.hand;
    if (!this.host.canInteract() || !hand.cards.length) {
      if (hand.hovered) hand.setHover(null);
      return;
    }
    const current = hand.hovered;
    if (current && current.getBounds().containsPoint(e.global.x, e.global.y)) return;
    const n = hand.cards.length;
    const slots = hand.cards.map((_, i) => hand.slotFor(i, n));
    const halfW = (CARD_W * slots[0]!.scale) / 2;
    const left = hand.x + slots[0]!.x - halfW;
    const right = hand.x + slots[n - 1]!.x + halfW;
    const top = hand.y + hand.bandTop + 50;
    if (p.y < top || p.x < left || p.x > right) {
      if (current) hand.setHover(null);
      return;
    }
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(p.x - (hand.x + slots[i]!.x)) < Math.abs(p.x - (hand.x + slots[best]!.x))) best = i;
    hand.setHover(hand.cards[best]!);
  }

  private onUp(e: FederatedPointerEvent): void {
    const pressed = this.pressed;
    const view = this.dragging;
    this.pressed = null;
    if (!view) {
      if (pressed && this.host.canInteract()) this.host.onInspect(pressed.cardUid);
      return;
    }
    const p = this.host.stage.root.toLocal(e.global);
    this.endDrag(view);
    const hand = this.host.hand;
    const inBand = p.y > hand.bandTop;
    if (inBand) {
      const at = hand.insertAt ?? this.originalIndex;
      hand.insertAt = null;
      this.returnToHand(view, at);
      this.host.onReorder(hand.order());
      return;
    }
    hand.insertAt = null;
    let played = false;
    if (this.host.isTargeted(view.cardUid)) {
      const enemyId = this.host.enemyAt(p.x, p.y);
      if (enemyId) played = this.host.onPlay(view.cardUid, enemyId);
    } else if (p.y < this.host.playLineY) {
      played = this.host.onPlay(view.cardUid);
    }
    if (!played) this.returnToHand(view, this.originalIndex, true);
  }

  private endDrag(view: CardView): void {
    if (this.tick) this.host.stage.app.ticker.remove(this.tick);
    this.tick = null;
    this.dragging = null;
    this.aiming = false;
    gsap.killTweensOf(view);
    this.host.hand.dragging = null;
    this.arrow.clear();
    this.setHint(false);
    this.host.highlightEnemy(null);
    view.setShadow(0);
    view.cursor = 'grab';
  }

  /** Back into the fan. The card keeps its world position, then the layout tween carries it home. */
  returnToHand(view: CardView, at: number, refused = false): void {
    const hand = this.host.hand;
    const global = view.getGlobalPosition();
    if (view.parent) view.parent.removeChild(view);
    hand.add(view, at);
    const local = hand.toLocal(global);
    view.position.set(local.x, local.y);
    if (refused && spatial()) {
      gsap.fromTo(view, { rotation: -0.08 }, { rotation: 0.08, duration: d(0.05), repeat: 3, yoyo: true });
    }
    hand.layout();
  }

  get isDragging(): boolean {
    return this.dragging !== null;
  }
}
