import type { Container} from 'pixi.js';
import { Graphics, type FederatedPointerEvent } from 'pixi.js';
import gsap from 'gsap';
import type { Stage } from '../../app/stage';
import { d, spatial } from '../kit/motion';
import { PALETTE } from '../kit/palette';
import { CARD_H, type CardView } from './CardView';
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
  highlightEnemy(id: string | null): void;
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
 */
export class DragController {
  private pressed: CardView | null = null;
  private dragging: CardView | null = null;
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
    view.on('pointerover', () => {
      if (this.dragging || !this.host.canInteract()) return;
      this.host.hand.setHover(view);
    });
    view.on('pointerout', () => {
      if (this.host.hand.hovered === view && !this.dragging) this.host.hand.setHover(null);
    });
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
      const enemyId = this.host.enemyAt(p.x, p.y);
      this.host.highlightEnemy(enemyId);
      this.setHint(false);
      // A bezier from the card up and over to the pointer, with an arrowhead.
      const x0 = view.x;
      const y0 = view.y - (CARD_H * 0.95) / 2;
      const cx = (x0 + p.x) / 2;
      const cy = Math.min(y0, p.y) - 120;
      const color = enemyId ? PALETTE.goldBright : PALETTE.parchmentDim;
      this.arrow.moveTo(x0, y0).quadraticCurveTo(cx, cy, p.x, p.y).stroke({ color, width: 6, alpha: 0.9, cap: 'round' });
      const ang = Math.atan2(p.y - cy, p.x - cx);
      this.arrow.poly([p.x, p.y, p.x - 22 * Math.cos(ang - 0.5), p.y - 22 * Math.sin(ang - 0.5), p.x - 22 * Math.cos(ang + 0.5), p.y - 22 * Math.sin(ang + 0.5)]).fill(color);
    } else {
      this.host.highlightEnemy(null);
      this.setHint(p.y < this.host.playLineY);
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
