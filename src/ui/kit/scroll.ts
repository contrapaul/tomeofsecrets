import { Container, Graphics, type FederatedPointerEvent, type FederatedWheelEvent } from 'pixi.js';
import { DESIGN } from '../../app/fit';
import { PALETTE } from './palette';

/**
 * A window onto a taller container: wheel, drag with inertia, touch, and a slim
 * bar that only shows when there is somewhere to go. The game's first scrolling
 * surface, built for the guide and meant to be reused by the Bestiary and Cards
 * tabs when later chapters make those lists too long.
 *
 * Put content in `content` and call `measure()` whenever its height changes.
 */
export class Scroll extends Container {
  /** Add your children here; its y is the scroll offset. */
  readonly content = new Container({ label: 'scroll-content' });

  private readonly window = new Graphics();
  private readonly bar = new Graphics();
  private readonly track = new Graphics();
  private inner = 0;
  private offset = 0;
  private velocity = 0;
  private dragging = false;
  private lastY = 0;
  private moved = 0;

  constructor(readonly viewWidth: number, readonly viewHeight: number) {
    super({ label: 'scroll' });
    this.window.rect(0, 0, viewWidth, viewHeight).fill(0xffffff);
    this.addChild(this.window, this.content);
    this.content.mask = this.window;

    this.track.roundRect(viewWidth + 10, 0, 4, viewHeight, 2).fill({ color: PALETTE.parchment, alpha: 0.08 });
    this.addChild(this.track, this.bar);

    this.eventMode = 'static';
    // The whole window catches the pointer, not just wherever a word happens to be.
    this.hitArea = { contains: (x, y) => x >= 0 && x <= viewWidth && y >= 0 && y <= viewHeight };
    this.on('wheel', (e: FederatedWheelEvent) => {
      this.velocity = 0;
      this.to(this.offset - e.deltaY);
    });
    this.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragging = true;
      this.moved = 0;
      this.lastY = e.global.y;
      this.velocity = 0;
    });
    this.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!this.dragging) return;
      const dy = e.global.y - this.lastY;
      this.lastY = e.global.y;
      this.moved += Math.abs(dy);
      this.velocity = dy;
      this.to(this.offset + dy);
    });
    for (const end of ['pointerup', 'pointerupoutside'] as const) this.on(end, () => { this.dragging = false; });
  }

  /**
   * Re-read the content's height. Call after adding or changing children.
   * Measured from the children rather than the container, because a masked
   * container reports the mask's height, not what is inside it.
   */
  measure(): void {
    let bottom = 0;
    for (const child of this.content.children) bottom = Math.max(bottom, child.y + child.getLocalBounds().height);
    this.inner = bottom;
    this.to(this.offset);
    this.paintBar();
  }

  /** True when the pointer travelled far enough that this was a scroll, not a tap. */
  get wasDrag(): boolean {
    return this.moved > 8;
  }

  get max(): number {
    return Math.max(0, this.inner - this.viewHeight);
  }

  scrollTo(y: number): void {
    this.velocity = 0;
    this.to(-y);
  }

  page(dir: 1 | -1): void {
    this.velocity = 0;
    this.to(this.offset - dir * (this.viewHeight - 80));
  }

  /** Called every frame by the scene: carries the drag's momentum. */
  update(): void {
    if (this.dragging || Math.abs(this.velocity) < 0.4) return;
    this.velocity *= 0.92;
    this.to(this.offset + this.velocity);
  }

  private to(next: number): void {
    this.offset = Math.min(0, Math.max(-this.max, next));
    this.content.y = Math.round(this.offset);
    this.paintBar();
  }

  private paintBar(): void {
    this.bar.clear();
    this.track.visible = this.max > 0;
    if (this.max <= 0) return;
    const height = Math.max(40, this.viewHeight * (this.viewHeight / this.inner));
    const y = (-this.offset / this.max) * (this.viewHeight - height);
    this.bar.roundRect(this.viewWidth + 10, y, 4, height, 2).fill({ color: PALETTE.gold, alpha: 0.5 });
  }
}

/** Keyboard paging for a focused scroll surface; returns the handler to remove. */
export function pageKeys(scroll: Scroll): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (e.key === 'PageDown') scroll.page(1);
    else if (e.key === 'PageUp') scroll.page(-1);
    else if (e.key === 'Home') scroll.scrollTo(0);
    else if (e.key === 'End') scroll.scrollTo(DESIGN.height * 99);
    else return;
    e.preventDefault();
  };
}
